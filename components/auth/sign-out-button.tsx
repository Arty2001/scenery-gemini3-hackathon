'use client'

import { Button } from '@/components/ui/button'
import { signOut } from '@/lib/actions/auth'
import { LogOut } from 'lucide-react'
import { useState } from 'react'

interface SignOutButtonProps {
  variant?: 'default' | 'ghost' | 'outline'
  showIcon?: boolean
  className?: string
}

export function SignOutButton({
  variant = 'ghost',
  showIcon = true,
  className,
}: SignOutButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSignOut = async () => {
    setIsLoading(true)
    await signOut()
    // Note: signOut() redirects, so this line may not execute
    setIsLoading(false)
  }

  return (
    <Button
      onClick={handleSignOut}
      disabled={isLoading}
      variant={variant}
      size="sm"
      className={className}
    >
      {showIcon && <LogOut className="mr-2 h-4 w-4" />}
      {isLoading ? 'Signing out...' : 'Sign out'}
    </Button>
  )
}
