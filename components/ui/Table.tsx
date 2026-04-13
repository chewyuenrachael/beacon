import { type FC } from 'react'
import { Inbox } from 'lucide-react'

interface TableColumn {
  key: string
  label?: string
  header?: string
  align?: 'left' | 'right'
  mono?: boolean
}

interface TableProps {
  columns: TableColumn[]
  data: Record<string, string | number | boolean | null | undefined>[]
  onRowClick?: (row: Record<string, string | number | boolean | null | undefined>) => void
}

function getColumnLabel(col: TableColumn): string {
  return col.label ?? col.header ?? col.key
}

export const Table: FC<TableProps> = ({ columns, data, onRowClick }) => {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Inbox size={32} className="mb-3" />
        <p className="text-sm">No data available</p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border-default">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs uppercase tracking-wider text-text-tertiary font-medium ${
                  col.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {getColumnLabel(col)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`border-b border-border-subtle transition-colors duration-200 ${
                onRowClick ? 'cursor-pointer hover:bg-[#F5F2EC]' : ''
              }`}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-sm text-text-primary ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.mono ? 'font-mono' : ''}`}
                >
                  {String(row[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
