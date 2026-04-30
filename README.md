# dropzone

Simple file drag & drop in React. Inspired by `react-dropzone`.

## Installation
```bash
npm install @lkekana/dropzone
```

## Why?

While working on an [Electron app](https://github.com/lkekana/diff), I discovered that `react-dropzone`'s event handling prevented Electron from being able to determine the full file path of dropped files ([see issue here](https://github.com/react-dropzone/react-dropzone/issues/1411)), which I needed in order to open the files in my app.

I created this package to provide a simple drag & drop solution, inspired by `react-dropzone`, to get around the issue.

## Peer Dependencies

This package requires React 18+:
```bash
npm install react@^18.0.0
```

## Usage

```tsx
import * as React from "react";
import { useDropzone } from "@lkekana/dropzone";

export function MyComponent() {
	const { getRootProps, getInputProps, isDragActive } = useDropzone({
		dialogAccept: ".png,.jpg,.jpeg",
		maxFiles: 5,
		onDrop: (files) => {
			console.log("Dropped/selected files:", files);
		},
	});

	return (
		<div
			{...getRootProps({
				style: {
					border: "2px dashed #ccc",
					padding: 16,
					borderRadius: 8,
				},
			})}
		>
			<input {...getInputProps()} />

			{isDragActive ? (
				<p>Drop files…</p>
			) : (
				<p>Drag & drop files here, or click to select</p>
			)}
		</div>
	);
}
```

## API

### `useDropzone(options?)`
- `disabled?: boolean`: disable drag/click/open
- `allowMultiple?: boolean`: allow selecting multiple files via dialog
- `dialogOnClick?: boolean`: open dialog on click (default: `true`)
- `dialogOnDoubleClick?: boolean`: open dialog on double click (default: `false`)
- `allowDrag?: boolean`: enable drag-and-drop (default: `true`)
- `dialogAccept?: string`: passed to `<input accept="...">` (does not filter dropped files)
- `maxFiles?: number`: return only the first `N` files
- `onDrop?(files, event)`: called on drop or dialog selection
- `onDragEnter?(event)`: called when a drag enters the dropzone
- `onDragOver?(event)`: called when a drag is over the dropzone
- `onDragLeave?(event)`: called when a drag leaves the dropzone
- `onFileDialogOpen?()`: called when the file dialog is opened
- `onFileSelected?(files)`: called when files are selected via the dialog *only* (not called on drop)

Returns:

- `isDragActive: boolean`: boolean state indicating if a file drag is active over the dropzone (only if `item.kind === "file"` in the drag event)
- `rootRef: React.RefObject`, `inputRef: React.RefObject`: React refs for the root element and hidden file input, respectively
- `open()`: programmatically open the file dialog
- `getRootProps(props?)`: get props to spread on the root `<div>` element. accepts any additional props to merge (e.g. `style`, `className`, etc.)
- `getInputProps(props?)`: get props to spread on the hidden `<input type="file">` element. accepts any additional props to merge (e.g. `accept`, `multiple`, etc.)

## Special Thanks
- react-dropzone: [repo](https://github.com/react-dropzone/react-dropzone), [npm](https://www.npmjs.com/package/react-dropzone)

## License
MIT License 📄 - See [LICENSE](https://github.com/lkekana/dropzone/blob/main/LICENSE) for details 