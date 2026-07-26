# Vercel Deployment Instructions for CV-Builder

## Overview
Please execute the following deployment plan to publish the `cv-builder` Next.js application to Vercel. As you are connected to the Vercel account, run these commands and configurations directly via the CLI.

## Phase 1: Pre-flight Checks & Build Verification
1. **Navigate to Project Root:** Ensure you are in the correct directory containing the Next.js application (`cv-builder` if nested, or root).
2. **Install Dependencies:** Run the package manager install command (e.g., `npm install`).
3. **Local Build Test:** Execute `npm run build` to verify that there are no TypeScript, linting, or Next.js build errors prior to pushing to Vercel.

## Phase 2: Vercel Initialization
1. **Link Project:** Run `vercel link` to connect this local repository to a Vercel project. Follow the prompts to set it up as a new project or link to an existing one.
2. **Configure Settings:** 
   - Ensure the Framework Preset is detected as **Next.js**.
   - If the Next.js app is located in a subdirectory (e.g., `./cv-builder`), ensure the **Root Directory** is configured accordingly in the Vercel settings so the build executes in the correct context.

## Phase 3: Environment Configuration
1. **Identify Required Variables:** Inspect the `.env.local.example` file to gather the list of required environment variables.
2. **Set Variables:** Add these variables to the Vercel project using `vercel env add`. Anticipated variables based on the codebase include:
   - Database connection URIs (e.g., MongoDB for `lib/mongodb.ts`).
   - Authentication secrets (e.g., `NEXTAUTH_SECRET`, `NEXTAUTH_URL` for `lib/auth.ts`).
3. **Wait for Input:** If any secure values (like production DB credentials) are missing, pause and prompt me to provide them before initiating the build.

## Phase 4: Production Deployment
1. **Deploy:** Execute `vercel deploy --prod` to push the application to production.
2. **Monitor:** Tail the deployment logs to ensure the build steps (Install, Build, Assign Domains) complete successfully.
3. **Auto-Correction:** If the deployment fails due to a configuration issue (e.g., missing environment variables or strict TypeScript errors), analyze the Vercel log output, propose a fix, apply it, and re-trigger the deployment.

## Phase 5: Verification & Handoff
1. Provide the final production URL upon successful deployment.
2. Run a quick validation to ensure the application loads and no immediate 500 errors are returned.
