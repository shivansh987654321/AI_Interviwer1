import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className="auth-wrapper">
      <SignIn />
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
