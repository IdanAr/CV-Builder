'use client'

import { useEffect, useRef, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import { toast } from '@/lib/stores/toast.store'
import {
  STEPS,
  clearDraft,
  emptyValues,
  formatValidationDetails,
  isDirty,
  readDraft,
  toPayload,
  validateStep,
  valuesFromProfile,
  writeDraft,
  type ExistingProfile,
  type ProfileFormValues,
} from './profile-form/model'
import { StepRail } from './profile-form/StepRail'
import { StepRole } from './profile-form/StepRole'
import { StepWhere } from './profile-form/StepWhere'
import { StepSources } from './profile-form/StepSources'
import { StepReview, type ResumeOption } from './profile-form/StepReview'

export interface ProfileFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  existingProfile?: ExistingProfile
  onSaved: (profile: { _id: string; name: string }) => void
}

const DESCRIPTIONS = [
  'What should this profile look for?',
  'Where should it look?',
  'Add companies and refinements.',
  'Check it over and set the filters.',
]

const LAST = STEPS.length - 1

/** Mounted only while open, so every open starts from fresh state. */
export function ProfileFormDialog(props: ProfileFormDialogProps) {
  if (!props.open) return null
  return <ProfileFormDialogInner {...props} />
}

function ProfileFormDialogInner({ onOpenChange, mode, existingProfile, onSaved }: ProfileFormDialogProps) {
  const isEditing = mode === 'edit' && !!existingProfile
  const [initial] = useState<ProfileFormValues>(() => (isEditing ? valuesFromProfile(existingProfile) : emptyValues()))
  const [draft] = useState(() => (isEditing ? null : readDraft()))
  const [values, setValues] = useState<ProfileFormValues>(draft?.values ?? initial)
  const [step, setStep] = useState(draft?.step ?? 0)
  const [maxUnlocked, setMaxUnlocked] = useState(isEditing ? LAST : (draft?.maxUnlocked ?? 0))
  const [nameError, setNameError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [confirmingClose, setConfirmingClose] = useState(false)
  const [resumeOptions, setResumeOptions] = useState<ResumeOption[]>([])
  const [opener] = useState<HTMLElement | null>(() =>
    typeof document !== 'undefined' && document.activeElement instanceof HTMLElement ? document.activeElement : null
  )
  const savedRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const prevStep = useRef(step)

  // Persist create-mode progress. Editing already has a server-side source of
  // truth, and writing it to the shared key would leak one profile into the
  // next new one. Once saved, the draft has done its job.
  useEffect(() => {
    if (isEditing || savedRef.current) return
    writeDraft({ version: 2, step, maxUnlocked, values })
  }, [isEditing, step, maxUnlocked, values])

  useEffect(() => {
    let cancelled = false
    async function loadResumes() {
      try {
        const res = await fetch('/api/resumes')
        if (!res.ok) throw new Error('failed to load resumes')
        const body = await res.json()
        const options: ResumeOption[] = Array.isArray(body.resumes)
          ? body.resumes.map((r: { _id: string; title: string }) => ({ id: r._id, title: r.title }))
          : []
        if (!cancelled) setResumeOptions(options)
      } catch {
        // Not fatal: the picker shows no options and scanning falls back to the
        // most recently updated résumé server-side.
        if (!cancelled) setResumeOptions([])
      }
    }
    void loadResumes()
    return () => {
      cancelled = true
    }
  }, [])

  // Move focus to the new step's panel so screen-reader focus does not stay on
  // the button just pressed while the content swaps. Comparing with the previous
  // step (not a one-shot flag) stays correct under Strict Mode's double effect.
  useEffect(() => {
    if (prevStep.current !== step) panelRef.current?.focus()
    prevStep.current = step
  }, [step])

  function patch(change: Partial<ProfileFormValues>) {
    setValues((v) => ({ ...v, ...change }))
    if ('name' in change) setNameError(null)
  }

  function requestClose() {
    if (isEditing && isDirty(values, initial)) {
      setConfirmingClose(true)
      return
    }
    onOpenChange(false)
  }

  function goTo(target: number) {
    if (target > 0) {
      const problem = validateStep(0, values)
      if (problem) {
        setNameError(problem)
        setStep(0)
        return
      }
    }
    setStep(target)
    setMaxUnlocked((m) => Math.max(m, target))
  }

  function goNext() {
    const problem = validateStep(step, values)
    if (problem) {
      setNameError(problem)
      return
    }
    goTo(Math.min(step + 1, LAST))
  }

  async function handleSubmit() {
    const problem = validateStep(0, values)
    if (problem) {
      setNameError(problem)
      setStep(0)
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(isEditing ? `/api/jobsearch/profiles/${existingProfile._id}` : '/api/jobsearch/profiles', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toPayload(values)),
      })
      const body = await res.json()
      if (!res.ok) {
        setError(`Failed to ${isEditing ? 'save changes' : 'create profile'}.${formatValidationDetails(body.details)}`)
        return
      }
      const saved = body.profile as { _id: string; name: string }
      savedRef.current = true
      if (!isEditing) {
        clearDraft()
        if (values.notifyOnMatch) await createNotifyRule(saved._id, values.minAtsScore)
      }
      onSaved(saved)
    } catch {
      setError('Something went wrong. Check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  async function createNotifyRule(profileId: string, minAtsScore: number) {
    const failed = () =>
      toast.error("Profile created, but the notify rule couldn't be added. Add one from the Rules tab.")
    try {
      const res = await fetch('/api/jobsearch/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          name: 'Notify on match',
          isActive: true,
          order: 0,
          conditions: [{ field: 'atsScore', op: 'gte', value: minAtsScore }],
          action: 'notify',
        }),
      })
      if (!res.ok) failed()
    } catch {
      failed()
    }
  }

  const title = isEditing ? `Edit ${existingProfile.name}` : 'New profile'
  const submitLabel = isEditing ? 'Save changes' : 'Create profile'

  const footer = confirmingClose ? (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm font-medium text-fg-heading">Discard your changes?</p>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="md" onClick={() => setConfirmingClose(false)}>
          Keep editing
        </Button>
        <Button type="button" variant="danger" size="md" onClick={() => onOpenChange(false)}>
          Discard changes
        </Button>
      </div>
    </div>
  ) : (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Button type="button" variant="ghost" size="md" onClick={requestClose}>
        Cancel
      </Button>
      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" size="md" onClick={() => goTo(step - 1)}>
            Back
          </Button>
        )}
        {step < LAST && (
          <Button type="button" variant={isEditing ? 'secondary' : 'primary'} size="md" onClick={goNext}>
            Next
          </Button>
        )}
        {(isEditing || step === LAST) && (
          <Button type="button" variant="primary" size="md" disabled={submitting} onClick={() => void handleSubmit()}>
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) requestClose()
      }}
      title={title}
      description={DESCRIPTIONS[step]}
      footer={footer}
      returnFocusTo={opener}
    >
      <div className="flex flex-col gap-5">
        <StepRail steps={STEPS} current={step} maxUnlocked={maxUnlocked} onStepClick={goTo} />
        {error && <ErrorBanner>{error}</ErrorBanner>}
        <div ref={panelRef} tabIndex={-1} className="flex flex-col focus-visible:outline-none">
          {step === 0 && <StepRole values={values} onChange={patch} nameError={nameError} />}
          {step === 1 && <StepWhere values={values} onChange={patch} />}
          {step === 2 && <StepSources values={values} onChange={patch} />}
          {step === 3 && (
            <StepReview
              values={values}
              onChange={patch}
              resumeOptions={resumeOptions}
              isEditing={isEditing}
              onJumpTo={goTo}
            />
          )}
        </div>
      </div>
    </Dialog>
  )
}
