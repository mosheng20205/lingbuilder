import type { ModuleDesignerEventParameter } from '../modules/types';
import {
  formatModuleDesignerEventParameters,
  upgradeLegacyModuleDesignerEventHandlerSignature
} from '../modules/moduleDesignerEventService';
import { upgradeLegacyWindowEventHandlerSignature } from './windowEventHandlerMigration';
import { formatWindowEventParameters } from './windowEventRegistry';

export interface OpenControlEventCodeDetail {
  controlId?: string;
  controlName?: string;
  controlContent?: string;
  controlType?: string;
  eventName?: string;
  handlerName?: string;
  eventParameters?: ModuleDesignerEventParameter[];
  eventStarterStatements?: string[];
  windowFileName?: string;
  windowClassName?: string;
  windowTitle?: string;
}

export function formatControlEventParameters(detail: OpenControlEventCodeDetail): string {
  if (detail.eventParameters !== undefined) {
    return formatModuleDesignerEventParameters(detail.eventParameters);
  }
  return detail.eventName ? formatWindowEventParameters(detail.eventName) : '';
}

export function upgradeLegacyControlEventHandlerSignature(
  content: string,
  detail: OpenControlEventCodeDetail
): { content: string; changed: boolean } {
  const handlerName = detail.handlerName?.trim() || '';
  if (detail.eventParameters !== undefined) {
    return upgradeLegacyModuleDesignerEventHandlerSignature(content, handlerName, detail.eventParameters);
  }
  return upgradeLegacyWindowEventHandlerSignature(content, handlerName, detail.eventName?.trim() || '');
}
