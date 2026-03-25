import { NextResponse } from 'next/server';
import {
  BUILDER_DETAIL_COLUMNS,
  CANONICAL_BUILDER_COLUMNS,
  MUTABLE_BUILDER_COLUMNS,
  serializeBuilderRows
} from '@/lib/builder-schema';
import {
  formatBuilderStorageError,
  getBuilderStorageConfig,
  getBuilderStorageTarget,
  readBuilderRecords
} from '@/lib/builder-storage';

export async function GET() {
  try {
    const records = await readBuilderRecords();

    return NextResponse.json({
      success: true,
      data: serializeBuilderRows(records),
      columns: CANONICAL_BUILDER_COLUMNS,
      detailColumns: BUILDER_DETAIL_COLUMNS,
      mutableColumns: MUTABLE_BUILDER_COLUMNS,
      source: getBuilderStorageTarget(),
      storage: getBuilderStorageConfig(),
      rows: records
    });

  } catch (error: unknown) {
    return NextResponse.json({
      success: false,
      error: formatBuilderStorageError(error)
    }, { status: 500 });
  }
}
