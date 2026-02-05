import { LoginForm } from "@/components/login-form";
import { SignInButton } from "@/components/auth/sign-in-button";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Scenery</h1>
          <p className="text-muted-foreground mt-2">
            Create stunning videos from your React components
          </p>
        </div>

        <div className="space-y-6">
          {/* GitHub OAuth - Primary sign-in method */}
          <SignInButton className="w-full" />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/password form */}
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
