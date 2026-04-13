import { type FC, type ChangeEventHandler } from 'react'
import { ChevronDown } from 'lucide-react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  label?: string
  value: string
  onChange: ChangeEventHandler<HTMLSelectElement>
  options: SelectOption[]
  placeholder?: string
  className?: string
}

export const Select: FC<SelectProps> = ({
  label,
  value,
  onChange,
  options,
  placeholder,
  className = '',
}) => {
  const selectId = label ? `select-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs uppercase tracking-wider text-text-secondary font-medium mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={selectId}
          value={value}
          onChange={onChange}
          className="h-9 w-full appearance-none rounded-md border border-[#D0CCC4] bg-white px-3 pr-9 text-sm text-text-primary transition-colors duration-200 focus:outline-none focus:border-[#C45A3C] focus:ring-1 focus:ring-[#C45A3C]/20"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        />
      </div>
    </div>
  )
}
