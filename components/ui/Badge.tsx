import { type FC, type ReactNode } from 'react'

type BadgeVariant = 'amber' | 'blue' | 'green' | 'red' | 'purple' | 'gray'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  children: ReactNode
  variant: BadgeVariant
  size?: BadgeSize
}

const variantClasses: Record<BadgeVariant, string> = {
  amber: 'bg-[#EDE0C8] text-[#8A6B20]',
  blue: 'bg-[#D4E0ED] text-[#3A5A80]',
  green: 'bg-[#D4E7D0] text-[#3D6B35]',
  red: 'bg-[#EDCFCF] text-[#8A2020]',
  purple: 'bg-[#E4D8ED] text-[#5A3D80]',
  gray: 'bg-[#E8E4D9] text-[#5C5A50]',
}

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2.5 py-1 text-xs',
}

export const Badge: FC<BadgeProps> = ({ children, variant, size = 'md' }) => {
  return (
    <span className={`inline-flex items-center font-medium tracking-wide rounded-sm ${variantClasses[variant]} ${sizeClasses[size]}`}>
      {children}
    </span>
  )
}
