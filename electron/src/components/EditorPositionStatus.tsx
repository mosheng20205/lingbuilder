import { formatEditorPositionStatus, TextEditorStatus } from '../services/textModel';

export default function EditorPositionStatus({ state }: { state: TextEditorStatus }) {
  const presentation = formatEditorPositionStatus(state);
  return (
    <div
      data-editor-position-status
      className="whitespace-nowrap rounded px-2 py-0.5 hover:bg-[#1f8ad2]"
      title={presentation.label}
      aria-label={presentation.label}
    >
      {presentation.text}
    </div>
  );
}
