import { type FC, type ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  header?: string | ReactNode
  noPadding?: boolean
}

export const Card: FC<CardProps> = ({ children, className = '', header, noPadding = false }) => {
  return (
    <div className={`rounded-md border border-border-subtle bg-surface transition-colors duration-200 ${className}`}>
      {header && (
        <div className="px-4 py-3 border-b border-border-subtle">
          {typeof header === 'string' ? (
            <h3 className="text-sm font-semibold text-text-primary">{header}</h3>
          ) : (
            header
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-4'}>
        {children}
      </div>
    </div>
  )
}
