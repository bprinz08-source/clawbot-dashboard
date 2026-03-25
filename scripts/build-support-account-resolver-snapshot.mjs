import { mkdir, readFile, writeFile } from 'fs/promises'
import path from 'path'

const DEFAULT_OUTPUT_PATH =
  '/home/gtm-employee/workspaces/asbuilt-support/artifacts/account-resolver-snapshot.json'
const SUPPORTED_EXPORT_ARRAY_KEYS = ['rows', 'records', 'resolverRows', 'data']

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeEmail(value) {
  return normalizeString(value).toLowerCase()
}

function normalizeDomain(value) {
  return normalizeString(value).toLowerCase().replace(/^@/, '')
}

function firstNonEmpty(record, keys) {
  for (const key of keys) {
    const value = record?.[key]

    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }

  return ''
}

function normalizeResolverRow(record) {
  if (!record || typeof record !== 'object') {
    return null
  }

  const normalized = {
    contactId: firstNonEmpty(record, ['contactId', 'contact_id']),
    contactName: firstNonEmpty(record, ['contactName', 'contact_name']),
    contactEmail: normalizeEmail(firstNonEmpty(record, ['contactEmail', 'contact_email'])),
    accountId: firstNonEmpty(record, ['accountId', 'account_id']),
    accountName: firstNonEmpty(record, ['accountName', 'account_name']),
    accountDomain: normalizeDomain(
      firstNonEmpty(record, ['accountDomain', 'account_domain'])
    ),
    propertyId: firstNonEmpty(record, ['propertyId', 'property_id']),
    propertyName: firstNonEmpty(record, ['propertyName', 'property_name']),
    binderId: firstNonEmpty(record, ['binderId', 'binder_id']),
    binderName: firstNonEmpty(record, ['binderName', 'binder_name'])
  }

  if (
    !normalized.contactId &&
    !normalized.contactName &&
    !normalized.contactEmail &&
    !normalized.accountId &&
    !normalized.accountName &&
    !normalized.accountDomain &&
    !normalized.propertyId &&
    !normalized.propertyName &&
    !normalized.binderId &&
    !normalized.binderName
  ) {
    return null
  }

  return normalized
}

function dedupeRows(rows) {
  const seen = new Set()

  return rows.filter((row) => {
    const key = [
      row.contactId,
      row.contactEmail,
      row.accountId,
      row.accountDomain,
      row.propertyId,
      row.binderId
    ].join('|')

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function parseExportRows(rawValue) {
  if (Array.isArray(rawValue)) {
    return rawValue
  }

  if (!rawValue || typeof rawValue !== 'object') {
    return []
  }

  for (const key of SUPPORTED_EXPORT_ARRAY_KEYS) {
    if (Array.isArray(rawValue[key])) {
      return rawValue[key]
    }
  }

  return []
}

function parseCsvLine(line) {
  const cells = []
  let current = ''
  let isQuoted = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const nextChar = line[index + 1]

    if (char === '"') {
      if (isQuoted && nextChar === '"') {
        current += '"'
        index += 1
        continue
      }

      isQuoted = !isQuoted
      continue
    }

    if (char === ',' && !isQuoted) {
      cells.push(current)
      current = ''
      continue
    }

    current += char
  }

  cells.push(current)
  return cells
}

function parseCsvRows(rawFile) {
  const normalizedFile = rawFile.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalizedFile
    .split('\n')
    .map((line) => line.trimEnd())
    .filter(Boolean)

  if (lines.length === 0) {
    return []
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.trim())

  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)

    return headers.reduce((record, header, index) => {
      record[header] = cells[index] ?? ''
      return record
    }, {})
  })
}

async function loadRowsFromSheetExport(exportPath) {
  const rawFile = await readFile(exportPath, 'utf8')
  const extension = path.extname(exportPath).toLowerCase()

  if (extension === '.csv') {
    return parseCsvRows(rawFile)
  }

  if (extension === '.json') {
    return parseExportRows(JSON.parse(rawFile))
  }

  throw new Error(
    `Unsupported sheet export format for ${exportPath}. Use a CSV export (recommended) or JSON export.`
  )
}

async function loadCanonicalResolverSourceRows() {
  const exportPath = normalizeString(process.env.SUPPORT_ACCOUNT_RESOLVER_SHEET_EXPORT_PATH)

  if (!exportPath) {
    throw new Error(
      'No Google Sheet export is configured. Set SUPPORT_ACCOUNT_RESOLVER_SHEET_EXPORT_PATH to a CSV export path (recommended) or JSON export path.'
    )
  }

  return {
    source: `google_sheet_export:${exportPath}`,
    rows: await loadRowsFromSheetExport(exportPath)
  }
}

async function writeSnapshot(outputPath, rows) {
  await mkdir(path.dirname(outputPath), { recursive: true })
  await writeFile(outputPath, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

async function main() {
  const outputPath =
    normalizeString(process.env.SUPPORT_ACCOUNT_RESOLVER_SNAPSHOT_PATH) || DEFAULT_OUTPUT_PATH
  const { source, rows } = await loadCanonicalResolverSourceRows()
  const normalizedRows = dedupeRows(rows.map(normalizeResolverRow).filter(Boolean))

  await writeSnapshot(outputPath, normalizedRows)

  console.log(
    JSON.stringify(
      {
        success: true,
        source,
        outputPath,
        rowCount: normalizedRows.length,
        recommendedFormat: 'csv'
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Snapshot build failed.',
        recommendedFormat: 'csv'
      },
      null,
      2
    )
  )
  process.exitCode = 1
})
