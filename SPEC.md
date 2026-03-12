# Atlas Platform - Professional Landing Experience

## Vision
A sophisticated, hyper-modern landing experience for Atlas by Panthera Capital Partners - showcasing the platform's power while providing secure membership-gated access to all 12 modules.

## Design Philosophy
- **Dark, premium aesthetic** - Deep blacks, subtle gradients, glassmorphism
- **Sophisticated typography** - Clean sans-serif, generous whitespace
- **Micro-interactions** - Smooth reveals, hover states, scroll animations
- **Banking-grade professionalism** - Trust signals, security badges, enterprise credibility

## Pages & Flow

### 1. Landing Page (/)
- **Hero Section**
  - Atlas logo with subtle glow animation
  - "Bankability & Asset Intelligence Operating System"
  - Tagline: "Where Projects Become Investable"
  - CTA: "Request Access"
  
- **Value Proposition**
  - 4 pillars: Speed, Intelligence, Transparency, Control
  - Animated icons on scroll
  
- **Module Preview**
  - 12-card grid showcasing each module
  - Hover reveals module description
  - Locked state for non-members
  
- **Enterprise Trust**
  - Security certifications
  - Client logos (placeholder)
  - Compliance badges
  
- **Footer**
  - Panthera branding
  - Contact, Privacy, Terms

### 2. Login (/login)
- Email/password form
- "Request Access" alternative
- Forgot password

### 3. Request Access (/request-access)
- Professional application form
  - Name, Organization, Email
  - Use case dropdown
  - Message textarea
- Submit → confirmation

### 4. Dashboard (/dashboard) - Members Only
- Welcome personalized header
- Quick stats cards
- Recent activity
- Quick links to modules
- Notifications panel

### 5. Module Navigation (/modules)
- All 12 modules in elegant grid
- Access based on membership tier
- Each card links to module page

## Membership Tiers
- **Executive**: Full access to all modules
- **Analyst**: Deal Radar, Documents, Bankability, Financial Models
- **Operator**: Execution, Assets, ESG
- **Viewer**: Dashboards, Reports only

## Visual Design
- Primary: #0a0a0a (deep black)
- Secondary: #1a1a2e (dark blue)
- Accent: #00d4ff (cyan glow)
- Text: #ffffff, #a0a0a0
- Cards: rgba(255,255,255,0.03) with blur
- Borders: rgba(255,255,255,0.08)

## Tech Stack
- Next.js 15
- Tailwind CSS
- Framer Motion for animations
- TypeScript

## Acceptance Criteria
- [ ] Landing page loads with smooth hero animation
- [ ] All 12 modules visible in preview grid
- [ ] Login flow works
- [ ] Dashboard shows personalized content
- [ ] Module cards link to existing module pages
- [ ] Mobile responsive
- [ ] Professional, enterprise-grade aesthetic
