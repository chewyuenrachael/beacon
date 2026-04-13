import { type FC } from 'react'

interface Tab {
  id: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeTab: string
  onChange?: (id: string) => void
  onTabChange?: (id: string) => void
}

export const Tabs: FC<TabsProps> = ({ tabs, activeTab, onChange, onTabChange }) => {
  const handleChange = onChange ?? onTabChange

  return (
    <div className="flex border-b border-border-subtle">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange?.(tab.id)}
          className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#C45A3C]/30 focus:ring-offset-2 focus:ring-offset-[#FAFAF7] -mb-px border-b-2 ${
            activeTab === tab.id
              ? 'border-[#C45A3C] text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
