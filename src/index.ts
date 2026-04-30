import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";

export interface UseDropzoneOptions {
	/** Disable all dropzone interactions (drag, click, programmatic open). */
	disabled?: boolean;

	/** Allow selecting multiple files via the file dialog input. */
	allowMultiple?: boolean;

	/** Open dialog on single click (excluding interactive children). */
	dialogOnClick?: boolean;

	/** Open dialog on double click (excluding interactive children). */
	dialogOnDoubleClick?: boolean;

	/** Enable drag and drop event handling. */
	allowDrag?: boolean;

	/**
	 * Accepted file types.
	 *
	 * Note: This does **not** filter files dropped via drag-and-drop; dropped files
	 * are passed through as-is.
	 *
	 * See: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/accept
	 */
	dialogAccept?: string;

	/**
	 * Maximum number of files to pass to `onDrop`.
	 *
	 * If more than `maxFiles` are provided (via drop or dialog), the list will contain only
	 * the first `N=maxFiles` in order.
	 */
	maxFiles?: number;

	/**
	 * Callback when files are dropped/selected
	 *
	 * Note on ordering:
	 * - If using `getRootProps()/getInputProps()`, the handler you pass in those props
	 *   runs first, then the hook’s internal handler runs, which then calls this `onDrop`.
	 */
	onDrop?: (
		files: File[],
		event:
			| React.DragEvent<HTMLDivElement>
			| React.ChangeEvent<HTMLInputElement>,
	) => void;

	/** Callback when a drag enters the dropzone */
	onDragEnter?: (event: React.DragEvent<HTMLDivElement>) => void;

	/** Callback when a drag leaves the dropzone */
	onDragLeave?: (event: React.DragEvent<HTMLDivElement>) => void;

	/** Callback when a drag is over the dropzone */
	onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;

	/** Callback when dialog is opened */
	onFileDialogOpen?: () => void;

	/** Callback when file(s) are selected from dialog (after onDrop) */
	onFileSelected?: () => void;
}

/**
 * @typedef {Object} UseDropzoneReturn
 * @property {boolean} isDragActive - Whether a file drag is currently active over the dropzone
 * @property {React.RefObject<HTMLDivElement>} rootRef - Ref for the root dropzone element
 * @property {React.RefObject<HTMLInputElement>} inputRef - Ref for the hidden file input
 * @property {() => void} open - Programmatically open the file selection dialog
 * @property {<T extends React.HTMLAttributes<HTMLDivElement>>(props?: T) => T} getRootProps -
 *   Get props for root element. Merges user props with required drag/click handlers.
 *   ⚠️ Do not pass `ref` here; use `rootRef` instead.
 * @property {<T extends React.InputHTMLAttributes<HTMLInputElement>>(props?: T) => T} getInputProps -
 *   Get props for hidden input. Merges user props with required attributes.
 *   ⚠️ Do not pass `ref` here; use `inputRef` instead.
 */
export interface UseDropzoneReturn {
	/** Whether a drag is currently active over the dropzone */
	isDragActive: boolean;
	/** Ref for the root element */
	rootRef: React.RefObject<HTMLDivElement>;
	/** Ref for the hidden input */
	inputRef: React.RefObject<HTMLInputElement>;
	/** Open the file dialog programmatically */
	open: () => void;
	/** Props to spread on the root element. Note: If you need to use a ref on the root element, use the `rootRef` because this function will override the ref passed in props. */
	getRootProps: <T extends React.HTMLAttributes<HTMLDivElement>>(
		props?: T,
	) => T;
	/** Props to spread on the hidden input. Note: If you need to use a ref on the input element, use the `inputRef` because this function will override the ref passed in props. */
	getInputProps: <T extends React.InputHTMLAttributes<HTMLInputElement>>(
		props?: T,
	) => T;
}

const isInteractiveElement = (target: EventTarget): boolean => {
	if (!(target instanceof HTMLElement)) return false;
	return (
		target.tagName === "BUTTON" ||
		target.tagName === "A" ||
		target.tagName === "INPUT" ||
		target.closest("button, a, input") !== null
	);
};

/**
 * Custom dropzone hook for React with Electron-compatible file path handling.
 *
 * Provides drag-and-drop and file dialog functionality without using stopPropagation,
 * making it compatible with Electron's file path exposure on File objects.
 *
 * @param {UseDropzoneOptions} [options] - Configuration options
 * @param {boolean} [options.disabled=false] - Disable all dropzone interactions
 * @param {boolean} [options.allowMultiple=true] - Allow selecting multiple files via dialog
 * @param {boolean} [options.dialogOnClick=true] - Open file dialog on single click of root
 * @param {boolean} [options.dialogOnDoubleClick=false] - Open file dialog on double click of root
 * @param {boolean} [options.allowDrag=true] - Enable drag-and-drop event handling
 * @param {string} [options.dialogAccept] - Accepted file types (HTML input accept format)
 * @param {number} [options.maxFiles] - Maximum files to process (excess files are truncated)
 * @param {(files: File[], event: React.DragEvent<HTMLDivElement> | React.ChangeEvent<HTMLInputElement>) => void} [options.onDrop] - Callback when files are dropped or selected
 * @param {(event: React.DragEvent<HTMLDivElement>) => void} [options.onDragEnter] - Callback when drag enters dropzone area
 * @param {(event: React.DragEvent<HTMLDivElement>) => void} [options.onDragLeave] - Callback when drag leaves dropzone area
 * @param {(event: React.DragEvent<HTMLDivElement>) => void} [options.onDragOver] - Callback when drag is over dropzone area
 * @param {() => void} [options.onFileDialogOpen] - Callback when file dialog opens
 * @param {() => void} [options.onFileSelected] - Callback when file(s) are selected from dialog (after onDrop)
 * @returns {UseDropzoneReturn} Object with refs, handlers, and prop getters for UI composition
 *
 * @example
 * ```tsx
 * const { getRootProps, getInputProps, isDragActive } = useDropzone({
 *   dialogAccept: ".png,.jpg,.jpeg",
 *   maxFiles: 5,
 *   onDrop: (files) => console.log(files)
 * });
 *
 * return (
 *   <div {...getRootProps()}>
 *     <input {...getInputProps()} />
 *     {isDragActive ? <p>Drop files...</p> : <p>Drag & drop or click to select</p>}
 *   </div>
 * );
 * ```
 *
 * @remarks
 * - **Electron compatibility**: Files dropped/selected will have `path` properties accessible
 * - **No stopPropagation**: This hook intentionally avoids `event.stopPropagation()` to preserve Electron's file path handling. Instead, it uses an internal drag counter to correctly manage drag state when child components are present.
 *   **Exception**: the hidden input's click handler stops propagation to avoid re-triggering the root click handler.
 * - **Callback execution**: Any event handlers passed in options will be called before the default handlers, allowing you to customize behavior. If your handler calls `event.preventDefault()` or `event.stopPropagation()`, it will affect this hook's behavior (e.g., preventing the file dialog from opening).
 * - **Ref management**: `getRootProps` and `getInputProps` manage refs internally. Use the returned `rootRef`/`inputRef` if you need direct element access; do not pass your own `ref` prop to these functions.
 */
export const useDropzone = ({
	disabled = false,
	allowMultiple = true,
	dialogOnClick = true,
	dialogOnDoubleClick = false,
	allowDrag = true,
	dialogAccept,
	maxFiles,
	onDrop,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onFileDialogOpen,
	onFileSelected,
}: UseDropzoneOptions = {}): UseDropzoneReturn => {
	const [isDragActive, setIsDragActive] = useState(false);

	const rootRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const dragCounter = useRef(0);
	const timeoutRef = useRef<number | null>(null);

	// Helper to process files (limit max files)
	const processFiles = useCallback(
		(files: File[]) => {
			if (maxFiles && files.length > maxFiles) {
				return files.slice(0, maxFiles);
			}
			return files;
		},
		[maxFiles],
	);

	// Drag event handlers
	const handleDragEnter = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled || !allowDrag || e.defaultPrevented) return;
			e.preventDefault();

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}

			dragCounter.current += 1;

			// Check if dragged items contain files
			if (dragCounter.current === 1) {
				if (e.dataTransfer.items.length > 0) {
					const hasFiles = Array.from(e.dataTransfer.items).some(
						(item) => item.kind === "file",
					);
					if (hasFiles) setIsDragActive(true);
				}
			}
			onDragEnter?.(e);
		},
		[disabled, allowDrag, onDragEnter],
	);

	const handleDragOver = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled || !allowDrag || e.defaultPrevented) return;
			e.preventDefault(); // Critical: enables onDrop
			onDragOver?.(e);
		},
		[disabled, allowDrag, onDragOver],
	);

	const handleDragLeave = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled || !allowDrag || e.defaultPrevented) return;
			e.preventDefault();

			dragCounter.current -= 1;

			// Only deactivate when counter reaches 0 (left entire dropzone tree)
			if (dragCounter.current <= 0) {
				// Timeout handles edge case: leave fires before enter on child
				timeoutRef.current = setTimeout(() => {
					if (dragCounter.current <= 0) {
						dragCounter.current = 0;
						setIsDragActive(false);
					}
				}, 0);
			}

			onDragLeave?.(e);
		},
		[disabled, allowDrag, onDragLeave],
	);

	const handleDrop = useCallback(
		(e: React.DragEvent<HTMLDivElement>) => {
			if (disabled || !allowDrag || e.defaultPrevented) return;
			e.preventDefault(); // Critical: prevents browser from opening the file

			// Reset drag state
			dragCounter.current = 0;
			setIsDragActive(false);

			const files = Array.from(e.dataTransfer.files);
			const processedFiles = processFiles(files);

			onDrop?.(processedFiles, e);
		},
		[disabled, allowDrag, onDrop, processFiles],
	);

	// File dialog handlers
	const openFileDialog = useCallback(() => {
		if (disabled) return;

		if (inputRef.current) {
			inputRef.current.click();
			onFileDialogOpen?.();
		}
	}, [disabled, onFileDialogOpen]);

	const handleInputClick = useCallback(
		(e: React.MouseEvent<HTMLInputElement>) => {
			// Prevent the hidden input's programmatic click from bubbling to the root and re-triggering openFileDialog()
			e.stopPropagation();
		},
		[],
	);

	const handleRootClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (disabled || !dialogOnClick || e.defaultPrevented) return;
			// Only open if clicking the root, not a child input/button
			const ref = rootRef.current;
			if (ref !== null) {
				const target = e.target as HTMLElement;

				if (!isInteractiveElement(target) && ref.contains(target)) {
					openFileDialog();
				}
			}
		},
		[disabled, dialogOnClick, openFileDialog],
	);

	const handleRootDoubleClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			if (disabled || !dialogOnDoubleClick || e.defaultPrevented) return;
			if (dialogOnClick) {
				throw new Error(
					"Cannot use both dialogOnClick and dialogOnDoubleClick. Please choose one to avoid double dialogs.",
				);
			}
			// Only open if clicking the root, not a child input/button
			const ref = rootRef.current;
			if (ref !== null) {
				const target = e.target as HTMLElement;

				if (!isInteractiveElement(target) && ref.contains(target)) {
					openFileDialog();
				}
			}
		},
		[disabled, dialogOnDoubleClick, openFileDialog, dialogOnClick],
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const files = e.target.files !== null ? Array.from(e.target.files) : [];
			const processedFiles = processFiles(files);

			onDrop?.(processedFiles, e);

			// Reset input so same file can be selected again
			if (inputRef.current) {
				inputRef.current.value = "";
			}

			onFileSelected?.();
		},
		[onFileSelected, onDrop, processFiles],
	);

	// Prop getters for easy composition
	const getRootProps = useCallback(
		<T extends React.HTMLAttributes<HTMLDivElement>>(
			props: T = {} as T,
		): T => ({
			...props,
			ref: rootRef,
			onClick: (e: React.MouseEvent<HTMLDivElement>) => {
				props.onClick?.(e);
				handleRootClick(e);
			},
			onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => {
				props.onDoubleClick?.(e);
				handleRootDoubleClick(e);
			},
			onDragEnter: (e: React.DragEvent<HTMLDivElement>) => {
				props.onDragEnter?.(e);
				handleDragEnter(e);
			},
			onDragOver: (e: React.DragEvent<HTMLDivElement>) => {
				props.onDragOver?.(e);
				handleDragOver(e);
			},
			onDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
				props.onDragLeave?.(e);
				handleDragLeave(e);
			},
			onDrop: (e: React.DragEvent<HTMLDivElement>) => {
				props.onDrop?.(e);
				handleDrop(e);
			},
			role: "region",
			"aria-disabled": disabled || undefined,
			"aria-label": disabled
				? "File dropzone (disabled)"
				: isDragActive
					? "Drop files to upload"
					: dialogOnDoubleClick
						? "File dropzone. Double click or drag files to upload."
						: "File dropzone. Click or drag files to upload.",
		}),
		[
			handleRootClick,
			handleRootDoubleClick,
			handleDragEnter,
			handleDragOver,
			handleDragLeave,
			handleDrop,
			dialogOnDoubleClick,
			disabled,
			isDragActive,
		],
	);

	const getInputProps = useCallback(
		<T extends React.InputHTMLAttributes<HTMLInputElement>>(
			props: T = {} as T,
		): T => ({
			...props,
			ref: inputRef,
			type: "file",
			style: { display: "none" },
			multiple: allowMultiple,
			accept: dialogAccept,
			onClick: handleInputClick,
			onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
				props.onChange?.(e);
				handleInputChange(e);
			},
			// Prevent keyboard interaction if disabled
			tabIndex: disabled ? -1 : undefined,
			disabled,
		}),
		[
			allowMultiple,
			dialogAccept,
			handleInputClick,
			handleInputChange,
			disabled,
		],
	);

	// Programmatically open dialog
	const open = useCallback(() => {
		if (!disabled) {
			openFileDialog();
		}
	}, [disabled, openFileDialog]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: We only want to run this on mount/unmount.
	useEffect(() => {
		if (dialogOnClick && dialogOnDoubleClick) {
			console.warn(
				"Use either dialogOnClick or dialogOnDoubleClick, not both, to avoid double dialogs.",
			);
		}

		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return useMemo(
		() => ({
			isDragActive,
			rootRef,
			inputRef,
			open,
			getRootProps,
			getInputProps,
		}),
		[isDragActive, open, getRootProps, getInputProps],
	);
};

// Notes on React drag events
/*
// used for when something is dragged over the element
onDragEnter
onDragLeave
onDragOver
- calling preventDefault() here enables onDrop
- fires repeatedly as the mouse moves over the element
onDrop
- calling preventDefault() here prevents the default browser behavior of opening the file

// when an element is being dragged
onDragStart
onDragEnd
onDrag

// deprecated version of onDragLeave
onDragExit
*/
