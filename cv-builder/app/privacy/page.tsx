import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/marketing/LegalPageShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How CV Builder collects, uses, and protects your personal data.',
}

const LAST_UPDATED = 'August 9, 2026'

export default function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={LAST_UPDATED}>
      <p>
        This Privacy Policy explains how CV Builder (&ldquo;CV Builder,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) collects, uses, discloses, and protects information when you use our website and
        résumé-building service (the &ldquo;Service&rdquo;). By creating an account or otherwise using the Service,
        you agree to the collection and use of information as described here.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">1. Information We Collect</h2>
        <p className="mt-2">
          <strong>Account information.</strong> We do not support password-based accounts. When you sign in with
          Google or GitHub, we receive your name, email address, and profile picture from that provider.
        </p>
        <p className="mt-2">
          <strong>Résumé and career data.</strong> Information you enter or upload while building a résumé -
          including your name, contact details, work history, education, skills, certifications, awards,
          publications, volunteer experience, languages, interests, projects, and any cover letter text - along with
          your chosen template and design settings.
        </p>
        <p className="mt-2">
          <strong>Job application data.</strong> If you use the application tracker, we store the companies, roles,
          statuses, and any custom fields you create, along with a log of changes made to each application (for your
          own reference).
        </p>
        <p className="mt-2">
          <strong>Uploaded files.</strong> If you upload an existing résumé (PDF or DOCX) to import it, the file is
          parsed to extract its text in order to prefill your résumé. The uploaded file itself is processed in
          memory and is not stored - only the résumé data you subsequently save is retained.
        </p>
        <p className="mt-2">
          <strong>Job posting text.</strong> If you paste a job description into the ATS scoring or cover letter
          tools, that text is processed to generate your results (see Section 3). It is held only in your browser
          session and is not saved to our database.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">2. How We Use Your Information</h2>
        <p className="mt-2">We use the information above to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Provide, maintain, and operate the résumé-building and application-tracking features of the Service;</li>
          <li>Generate AI-assisted writing suggestions, ATS compatibility scores, keyword matching, and cover letters (see Section 3 below);</li>
          <li>Authenticate you and keep your account secure;</li>
          <li>Respond to support requests you send us; and</li>
          <li>Diagnose and fix technical problems with the Service.</li>
        </ul>
        <p className="mt-2">
          We do not use your résumé or application data for advertising, and we do not sell your personal
          information to anyone.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">3. AI-Assisted Features</h2>
        <p className="mt-2">
          Certain features - writing suggestions, ATS scoring and keyword matching, ATS-format rewrites, and cover
          letter generation - send the relevant text of your résumé and, where applicable, any job description you
          paste in (not the raw uploaded file) to Anthropic&apos;s Claude API for processing. Anthropic processes
          this text solely to generate the requested output and according to its own terms. AI-generated suggestions
          are shown to you for review, and - where the system flags a claim it cannot verify against your original
          text - for your explicit approval, before anything is saved to your résumé.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">4. How We Share Your Information</h2>
        <p className="mt-2">
          We do not sell your personal information. We share information only with the service providers who help
          us operate the Service, each acting on our behalf and only to the extent needed to provide their part of
          it:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li><strong>Google</strong> and <strong>GitHub</strong> - for authentication (OAuth sign-in);</li>
          <li><strong>Anthropic</strong> - to power AI-assisted writing, scoring, and extraction features (Section 3);</li>
          <li><strong>MongoDB, Inc. (MongoDB Atlas)</strong> - to store your account and résumé data in our database; and</li>
          <li><strong>Vercel, Inc.</strong> - to host and serve the application.</li>
        </ul>
        <p className="mt-2">
          We do not use any advertising, analytics, or tracking services - the Service does not include any
          third-party analytics or tracking scripts. We may also disclose information if required to do so by law,
          or to protect the rights, property, or safety of CV Builder, our users, or others.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">5. Cookies &amp; Local Storage</h2>
        <p className="mt-2">
          We use only the cookies necessary to keep you signed in: a session cookie set by our authentication
          system, and short-lived cookies used during the Google/GitHub sign-in process itself. We do not use
          advertising or cross-site tracking cookies. We also store display preferences - such as your chosen
          application board view and preview zoom level - locally in your browser; this data never leaves your
          device.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">6. Data Retention &amp; Deletion</h2>
        <p className="mt-2">
          We retain your account, résumé, and application data for as long as your account exists, so that the
          Service remains available to you. You can permanently delete an individual résumé or job application at
          any time from your dashboard; deleting a job application also deletes its associated activity log. To
          request deletion of your entire account and all associated data, contact us at{' '}
          <a href="mailto:idan.rbel@gmail.com" className="text-indigo-600 hover:text-indigo-800">
            idan.rbel@gmail.com
          </a>{' '}
          - we will process such requests within a reasonable time.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">7. Your Privacy Rights</h2>
        <p className="mt-2">
          Subject to applicable law, you have the right to access the personal data we hold about you, request
          correction of inaccurate data, request deletion of your data, and object to certain processing. You can
          exercise most of these rights directly within the Service (editing or deleting your résumés and
          applications); for anything else, contact us at{' '}
          <a href="mailto:idan.rbel@gmail.com" className="text-indigo-600 hover:text-indigo-800">
            idan.rbel@gmail.com
          </a>
          .
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">8. Data Security</h2>
        <p className="mt-2">
          We do not store passwords - sign-in is handled entirely through Google and GitHub&apos;s own OAuth
          systems. Data is transmitted over encrypted (HTTPS) connections, and we apply reasonable technical and
          organizational measures to protect your information. No method of transmission or storage is completely
          secure, and we cannot guarantee absolute security.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">9. International Data Transfers</h2>
        <p className="mt-2">
          Our service providers (including Anthropic, MongoDB Atlas, and Vercel) may process and store data on
          servers located outside of your country of residence, including outside of Israel. By using the Service,
          you consent to this transfer, storage, and processing of your information.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">10. Children&apos;s Privacy</h2>
        <p className="mt-2">
          The Service is not directed to, and is not intended for use by, individuals under the age of 16. We do
          not knowingly collect personal information from children under 16. If you believe a child has provided us
          with personal information, please contact us and we will take steps to delete it.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">11. Governing Law</h2>
        <p className="mt-2">
          This Privacy Policy is governed by the laws of the State of Israel, including the Protection of Privacy
          Law, 5741-1981, and its regulations and amendments, without regard to conflict-of-law principles.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">12. Changes to This Policy</h2>
        <p className="mt-2">
          We may update this Privacy Policy from time to time. If we make material changes, we will update the
          &ldquo;Last updated&rdquo; date above. Your continued use of the Service after a change becomes effective
          constitutes acceptance of the revised policy.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">13. Contact Us</h2>
        <p className="mt-2">
          If you have questions about this Privacy Policy or how we handle your information, contact us at{' '}
          <a href="mailto:idan.rbel@gmail.com" className="text-indigo-600 hover:text-indigo-800">
            idan.rbel@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  )
}
