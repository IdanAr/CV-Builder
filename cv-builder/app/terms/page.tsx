import type { Metadata } from 'next'
import { LegalPageShell } from '@/components/marketing/LegalPageShell'

export const metadata: Metadata = {
  title: 'Terms of Use',
  description: 'The terms that govern your use of the CV Builder service.',
}

const LAST_UPDATED = 'August 9, 2026'

export default function TermsOfUsePage() {
  return (
    <LegalPageShell title="Terms of Use" lastUpdated={LAST_UPDATED}>
      <p>
        These Terms of Use (&ldquo;Terms&rdquo;) govern your access to and use of CV Builder (&ldquo;CV
        Builder,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;our&rdquo;) and the résumé-building and job
        application tracking service available through it (the &ldquo;Service&rdquo;). By accessing or using the
        Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
      </p>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">1. Description of the Service</h2>
        <p className="mt-2">
          CV Builder is an AI-assisted résumé and cover letter builder. It lets you create and format a résumé
          using pre-built templates, upload an existing résumé to import its content, receive AI-generated writing
          suggestions and Applicant Tracking System (ATS) compatibility scoring, export your résumé as a PDF or
          Word document, and track the status of your job applications.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">2. Eligibility</h2>
        <p className="mt-2">
          You must be at least 16 years old to use the Service. By using the Service, you represent that you meet
          this requirement and that you have the legal capacity to enter into these Terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">3. Your Account</h2>
        <p className="mt-2">
          You sign in to the Service using your existing Google or GitHub account; we do not maintain separate
          passwords. You are responsible for maintaining the security of that third-party account and for all
          activity that occurs through your CV Builder account. Notify us promptly if you become aware of any
          unauthorized use.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">4. Your Content</h2>
        <p className="mt-2">
          You retain ownership of the résumé data, uploaded files, cover letters, and application-tracking data you
          submit to the Service (&ldquo;Your Content&rdquo;). You grant us a limited, non-exclusive license to
          store, process, and display Your Content solely to provide the Service to you - for example, rendering
          your résumé, generating AI suggestions from it, and producing your exported PDF/DOCX files. You are
          responsible for ensuring you have the right to submit Your Content, including any information about
          former employers or references you include.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">5. AI-Generated Content Disclaimer</h2>
        <p className="mt-2">
          The Service uses artificial intelligence to suggest bullet points, rewrite text, score your résumé
          against Applicant Tracking Systems, and draft cover letters. AI-generated output may be inaccurate,
          incomplete, or contain claims not supported by the information you provided - this is why certain
          suggestions require your explicit review and approval before being saved. You are solely responsible for
          reviewing all AI-generated content for accuracy before relying on it, saving it, or submitting it to any
          employer. An ATS compatibility score is an estimate based on general parsing heuristics; it is not a
          guarantee that any specific Applicant Tracking System will process your résumé in a particular way, and it
          is not a guarantee of any interview, offer, or other employment outcome.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">6. Acceptable Use</h2>
        <p className="mt-2">You agree not to:</p>
        <ul className="mt-2 list-disc space-y-1 pl-6">
          <li>Use the Service for any unlawful purpose or in violation of any applicable law;</li>
          <li>Upload or submit content you do not have the right to share, or that infringes another person&apos;s rights;</li>
          <li>Attempt to circumvent rate limits, reverse-engineer, or interfere with the operation of the Service or its AI features;</li>
          <li>Use automated means to scrape, extract, or access the Service outside of its intended interface; or</li>
          <li>Impersonate any person or misrepresent your affiliation with any person or entity; or</li>
          <li>Use the Service to generate false or misleading employment credentials.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">7. Intellectual Property</h2>
        <p className="mt-2">
          The Service, including its templates, design, software, and branding, is owned by CV Builder and
          protected by applicable intellectual property laws. Except for the limited license described in Section
          4, nothing in these Terms grants you any right to CV Builder&apos;s intellectual property. Your Content
          remains yours, as described in Section 4.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">8. Third-Party Services</h2>
        <p className="mt-2">
          The Service relies on third-party providers, including Google and GitHub for sign-in and Anthropic for
          AI-assisted features. Your use of those providers&apos; services through CV Builder is also subject to
          their own terms and privacy policies. We are not responsible for the availability or conduct of
          third-party services.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">9. Service Availability &amp; Changes</h2>
        <p className="mt-2">
          We may modify, suspend, or discontinue any part of the Service, including specific features, at any time.
          We will try to give reasonable notice of material changes where practical, but are not obligated to do
          so.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">10. Termination</h2>
        <p className="mt-2">
          You may stop using the Service at any time, and may delete individual résumés or applications directly
          from your dashboard, or request deletion of your entire account by contacting{' '}
          <a href="mailto:idan.rbel@gmail.com" className="text-indigo-600 hover:text-indigo-800">
            idan.rbel@gmail.com
          </a>
          . We may suspend or terminate your access to the Service if we reasonably believe you have violated these
          Terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">11. Disclaimers</h2>
        <p className="mt-2">
          The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
          kind, whether express or implied, including implied warranties of merchantability, fitness for a
          particular purpose, or non-infringement. We do not warrant that the Service will be uninterrupted,
          error-free, or that any AI-generated content will be accurate or fit for your purposes.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">12. Limitation of Liability</h2>
        <p className="mt-2">
          To the maximum extent permitted by applicable law, CV Builder shall not be liable for any indirect,
          incidental, special, consequential, or punitive damages, or any loss of employment opportunity, income,
          data, or goodwill, arising out of or related to your use of the Service, even if we have been advised of
          the possibility of such damages.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">13. Governing Law</h2>
        <p className="mt-2">
          These Terms are governed by the laws of the State of Israel, without regard to its conflict-of-law
          principles. Any dispute arising under these Terms shall be subject to the exclusive jurisdiction of the
          competent courts of Israel.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">14. Changes to These Terms</h2>
        <p className="mt-2">
          We may update these Terms from time to time. If we make material changes, we will update the &ldquo;Last
          updated&rdquo; date above. Your continued use of the Service after a change becomes effective constitutes
          acceptance of the revised Terms.
        </p>
      </section>

      <section>
        <h2 className="text-xl font-semibold text-gray-900">15. Contact Us</h2>
        <p className="mt-2">
          If you have questions about these Terms, contact us at{' '}
          <a href="mailto:idan.rbel@gmail.com" className="text-indigo-600 hover:text-indigo-800">
            idan.rbel@gmail.com
          </a>
          .
        </p>
      </section>
    </LegalPageShell>
  )
}
