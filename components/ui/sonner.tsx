'use client'

import { Toaster as Sonner, ToasterProps } from 'sonner'
import useStore from '@/store'

const Toaster = ({ ...props }: ToasterProps) => {
  const darkMode = useStore((state) => state.darkMode)
  const theme = darkMode ? 'dark' : 'light'

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
