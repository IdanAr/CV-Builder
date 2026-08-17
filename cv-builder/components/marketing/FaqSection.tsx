'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Collapsible } from '@/components/ui/motion/Collapsible'

const FAQS = [
  {
    question: 'What is an ATS-friendly CV?',
    answer:
      'An Applicant Tracking System (ATS) is software many employers use to scan and filter resumes before a human sees them. An ATS-friendly CV uses clean, linear formatting and the right keywords so it parses correctly instead of getting rejected or misread.',
  },
  {
    question: 'How does the AI CV builder work?',
    answer:
      'Our AI reviews your work history and target role, then suggests stronger bullet points, rewrites weak phrasing, and can generate a matching cover letter - you review and approve every change before it\'s saved.',
  },
  {
    question: 'Can I export my CV to PDF or Word?',
    answer: 'Yes - built-in PDF and DOCX export are included, in both a fully designed layout and a strict ATS-safe layout.',
  },
  {
    question: 'Is my data secure?',
    answer:
      'Your resume data is tied to your signed-in account and never shared with third parties. You can edit or delete your data at any time from your dashboard.',
  },
] as const

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-16">
      <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Frequently Asked Questions</h2>
      <div className="mt-8 space-y-3">
        {FAQS.map(({ question, answer }, i) => {
          const isOpen = openIndex === i
          return (
            <div key={question} className="rounded-2xl border border-indigo-100 bg-white/70 backdrop-blur-xl">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? null : i)}
                className="flex w-full items-center justify-between px-5 py-4 text-left"
              >
                <span className="text-sm font-semibold text-gray-900">{question}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-indigo-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>
              <Collapsible open={isOpen}>
                <p className="px-5 pb-4 text-sm text-gray-600">{answer}</p>
              </Collapsible>
            </div>
          )
        })}
      </div>
    </section>
  )
}
