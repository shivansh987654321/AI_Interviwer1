import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <div className="auth-wrapper">
      <SignUp />
      <style jsx>{`
        .auth-wrapper {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
        }
      `}</style>
    </div>
  );
}
