import { Card, SectionTitle, Pill } from '@/components/ui';

const securityFeatures = [
  { name: 'JWT Authentication', desc: 'HS256 access tokens (15m) + refresh tokens (7d)', status: 'Active' },
  { name: 'MFA / TOTP', desc: 'Time-based one-time passwords via otpauth, 10 recovery codes', status: 'Active' },
  { name: 'Session Management', desc: 'List, revoke, and revoke-all with SHA-256 token hashing', status: 'Active' },
  { name: 'RBAC', desc: '5 org roles (owner, admin, member, viewer, billing) + 3 workspace roles', status: 'Active' },
  { name: 'ABAC', desc: 'Attribute-based policies with deny-first evaluation, stored per-org', status: 'Active' },
  { name: 'SSO', desc: 'SAML/OIDC provider config surface, stub ready for IdP integration', status: 'Config' },
  { name: 'Audit Logging', desc: 'All CRUD, auth, approval, and export actions centrally logged', status: 'Active' },
  { name: 'Password Security', desc: 'bcrypt with 12 salt rounds, minimum 8 characters', status: 'Active' },
];

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Admin" title="Security" subtitle="Authentication, authorization, and compliance controls." />

      <div className="grid gap-4 sm:grid-cols-2">
        {securityFeatures.map((f) => (
          <Card key={f.name}>
            <div className="flex items-center justify-between">
              <p className="font-medium text-white">{f.name}</p>
              <Pill tone={f.status === 'Active' ? 'success' : 'warn'}>{f.status}</Pill>
            </div>
            <p className="mt-2 text-sm text-slate-400">{f.desc}</p>
          </Card>
        ))}
      </div>

      <Card>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-widest text-cyan-300">MFA Enrollment Flow</h3>
        <ol className="list-inside list-decimal space-y-1 text-sm text-slate-300">
          <li>POST /api/auth/mfa/enroll - Get secret + otpauth URI</li>
          <li>Scan QR code or enter secret in authenticator app</li>
          <li>POST /api/auth/mfa/verify - Confirm with 6-digit code</li>
          <li>Save 10 recovery codes securely</li>
          <li>Login now requires mfaToken or recoveryCode</li>
        </ol>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-medium uppercase tracking-widest text-cyan-300">Session API</h3>
        <ul className="space-y-1 text-sm text-slate-300">
          <li>GET /api/auth/sessions - List all active sessions</li>
          <li>DELETE /api/auth/sessions/&#123;id&#125; - Revoke specific session</li>
          <li>DELETE /api/auth/sessions - Revoke all other sessions</li>
          <li>POST /api/auth/refresh - Rotate tokens</li>
        </ul>
      </Card>
    </div>
  );
}
