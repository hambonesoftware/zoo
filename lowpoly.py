#!/usr/bin/env python3
"""
Mesh Simplifier GUI

A Tkinter application that:
- Accepts 3D mesh files (OBJ, PLY, STL, etc.)
- Lets you drag & drop a file or choose via a file dialog
- Simplifies the mesh using PyVista's decimate_pro (low-poly / faceted look)
- Saves the simplified mesh next to the input with a "_lowpoly" suffix
- Renders a preview image of the simplified mesh and shows it in the GUI

Dependencies:
    pip install pyvista pillow tkinterdnd2

If tkinterdnd2 is not installed, drag & drop is disabled but the app still works.
"""

import threading
from pathlib import Path
from typing import Optional, Tuple

import tkinter as tk
from tkinter import ttk, filedialog, messagebox

# Optional drag-and-drop support via tkinterdnd2
try:
    from tkinterdnd2 import TkinterDnD, DND_FILES

    DND_AVAILABLE = True
except ImportError:
    TkinterDnD = None  # type: ignore[assignment]
    DND_FILES = None   # type: ignore[assignment]
    DND_AVAILABLE = False

import pyvista as pv
from PIL import Image, ImageTk

# Global off-screen flag for PyVista (used by some helpers)
pv.OFF_SCREEN = True


def simplify_mesh(
    input_path: Path,
    output_path: Path,
    reduction: float,
    preserve_topology: bool,
) -> Tuple[pv.PolyData, pv.PolyData]:
    """
    Load a mesh, decimate it using PyVista's decimate_pro, and save the result.

    Parameters
    ----------
    input_path : Path
        Path to the input mesh file (OBJ, PLY, STL, etc.).
    output_path : Path
        Path to write the simplified mesh.
    reduction : float
        Fraction of triangles to remove. 0.8 removes 80% of triangles,
        leaving about 20% of the original detail.
    preserve_topology : bool
        Pass through to decimate_pro(preserve_topology=...).

    Returns
    -------
    original : pv.PolyData
        The original mesh surface (triangulated).
    simplified : pv.PolyData
        The simplified (decimated) mesh.
    """
    print(f"[simplify_mesh] Loading mesh from: {input_path}")
    mesh = pv.read(str(input_path))

    # Ensure we have a PolyData surface with triangles.
    if not isinstance(mesh, pv.PolyData):
        print("[simplify_mesh] Input is not PolyData; extracting surface.")
        mesh = mesh.extract_surface()

    # is_all_triangles is a PROPERTY, not a method → no parentheses
    # https://docs.pyvista.org/api/core/_autosummary/pyvista.PolyData.is_all_triangles.html
    if not mesh.is_all_triangles:
        print("[simplify_mesh] Mesh is not all triangles; triangulating.")
        mesh = mesh.triangulate()

    print("[simplify_mesh] Original mesh summary:")
    print(mesh)

    print(
        f"[simplify_mesh] Decimating with reduction={reduction:.3f}, "
        f"preserve_topology={preserve_topology}"
    )

    simplified = mesh.decimate_pro(
        reduction=reduction,
        preserve_topology=preserve_topology,
        inplace=False,
        progress_bar=False,
    )

    print("[simplify_mesh] Simplified mesh summary:")
    print(simplified)

    print(f"[simplify_mesh] Saving simplified mesh to: {output_path}")
    simplified.save(str(output_path))
    print("[simplify_mesh] Done.")

    return mesh, simplified


def render_preview_image(
    mesh: pv.PolyData,
    window_size: Tuple[int, int] = (512, 512),
) -> Image.Image:
    """
    Render a preview image of the given mesh using an off-screen PyVista plotter.

    Parameters
    ----------
    mesh : pv.PolyData
        Mesh to render.
    window_size : (int, int)
        Size of the rendered image in pixels (width, height).

    Returns
    -------
    img : PIL.Image.Image
        A Pillow Image containing the rendered preview.
    """
    print("[render_preview_image] Rendering preview image...")
    # Explicitly use off_screen=True here (supported Plotter kwarg)
    # https://docs.pyvista.org/api/plotting/_autosummary/pyvista.Plotter.html
    plotter = pv.Plotter(off_screen=True, window_size=window_size)
    plotter.set_background("white")
    plotter.add_mesh(
        mesh,
        color="lightgray",
        show_edges=True,
        edge_color="black",
        line_width=0.5,
    )
    plotter.add_axes()
    plotter.view_isometric()
    img_array = plotter.screenshot(return_img=True)
    plotter.close()

    image = Image.fromarray(img_array)
    print("[render_preview_image] Preview rendering complete.")
    return image


if DND_AVAILABLE:
    BaseTk = TkinterDnD.Tk  # type: ignore[assignment]
else:
    BaseTk = tk.Tk


class MeshSimplifierApp(BaseTk):
    """
    Tkinter GUI application for simplifying meshes and previewing the result.
    """

    def __init__(self):
        super().__init__()

        self.title("Mesh Simplifier - Low Poly / Faceted Generator")
        self.geometry("900x600")

        # State variables
        self.input_path_var = tk.StringVar(value="")
        self.reduction_var = tk.DoubleVar(value=0.8)
        self.preserve_topology_var = tk.BooleanVar(value=False)
        self.status_var = tk.StringVar(value="Drop a mesh file or click 'Browse...'")

        self.preview_image: Optional[Image.Image] = None
        self.preview_photo: Optional[ImageTk.PhotoImage] = None

        self._build_ui()

    def _build_ui(self) -> None:
        """
        Build the full UI layout.
        """
        # Main layout: top controls, bottom preview
        main_frame = ttk.Frame(self)
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        controls_frame = ttk.LabelFrame(main_frame, text="Mesh Simplification")
        controls_frame.pack(side=tk.TOP, fill=tk.X, expand=False, padx=5, pady=5)

        # Input row
        input_row = ttk.Frame(controls_frame)
        input_row.pack(fill=tk.X, pady=5)

        input_label = ttk.Label(input_row, text="Input mesh file:")
        input_label.pack(side=tk.LEFT)

        self.input_entry = ttk.Entry(
            input_row, textvariable=self.input_path_var, width=60
        )
        self.input_entry.pack(side=tk.LEFT, padx=5, fill=tk.X, expand=True)

        browse_button = ttk.Button(
            input_row, text="Browse...", command=self.on_browse_clicked
        )
        browse_button.pack(side=tk.LEFT)

        # Drag-and-drop hint / setup
        dnd_frame = ttk.Frame(controls_frame)
        dnd_frame.pack(fill=tk.X, pady=2)

        if DND_AVAILABLE:
            dnd_label_text = (
                "Tip: You can drag & drop a file onto the input field."
            )
        else:
            dnd_label_text = (
                "Drag & drop disabled (install 'tkinterdnd2' to enable). "
                "Use 'Browse...' instead."
            )

        dnd_label = ttk.Label(
            dnd_frame,
            text=dnd_label_text,
            foreground="#555555",
            wraplength=600,
            justify=tk.LEFT,
        )
        dnd_label.pack(side=tk.LEFT, padx=2)

        if DND_AVAILABLE:
            # Register the input entry as a drop target
            self.input_entry.drop_target_register(DND_FILES)  # type: ignore[arg-type]
            self.input_entry.dnd_bind("<<Drop>>", self.on_drop_file)  # type: ignore[call-arg]

        # Reduction slider row
        reduction_frame = ttk.Frame(controls_frame)
        reduction_frame.pack(fill=tk.X, pady=5)

        reduction_label = ttk.Label(reduction_frame, text="Reduction (fraction to remove):")
        reduction_label.pack(side=tk.LEFT)

        reduction_scale = ttk.Scale(
            reduction_frame,
            from_=0.1,
            to=0.95,
            orient=tk.HORIZONTAL,
            variable=self.reduction_var,
        )
        reduction_scale.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=5)

        reduction_value_label = ttk.Label(
            reduction_frame,
            textvariable=self.reduction_var,
            width=6,
        )
        reduction_value_label.pack(side=tk.LEFT, padx=2)

        # Preserve topology checkbox
        options_frame = ttk.Frame(controls_frame)
        options_frame.pack(fill=tk.X, pady=5)

        preserve_check = ttk.Checkbutton(
            options_frame,
            text="Preserve topology (may restrict simplification)",
            variable=self.preserve_topology_var,
        )
        preserve_check.pack(side=tk.LEFT)

        # Action buttons
        buttons_frame = ttk.Frame(controls_frame)
        buttons_frame.pack(fill=tk.X, pady=5)

        simplify_button = ttk.Button(
            buttons_frame,
            text="Simplify & Preview",
            command=self.on_simplify_clicked,
        )
        simplify_button.pack(side=tk.LEFT, padx=5)

        quit_button = ttk.Button(buttons_frame, text="Quit", command=self.destroy)
        quit_button.pack(side=tk.LEFT, padx=5)

        # Status label
        status_label = ttk.Label(
            controls_frame,
            textvariable=self.status_var,
            relief=tk.SUNKEN,
            anchor=tk.W,
        )
        status_label.pack(fill=tk.X, pady=5)

        # Preview frame
        preview_frame = ttk.LabelFrame(main_frame, text="Simplified Mesh Preview")
        preview_frame.pack(side=tk.TOP, fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Scrollable canvas for preview
        canvas = tk.Canvas(preview_frame, background="#dddddd")
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        scrollbar_y = ttk.Scrollbar(preview_frame, orient=tk.VERTICAL, command=canvas.yview)
        scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)

        canvas.configure(yscrollcommand=scrollbar_y.set)

        # Inner frame inside canvas
        self.preview_inner_frame = ttk.Frame(canvas)
        self.preview_inner_frame_id = canvas.create_window(
            (0, 0), window=self.preview_inner_frame, anchor="nw"
        )

        self.preview_label = ttk.Label(
            self.preview_inner_frame,
            text="No preview yet.\nSimplified preview will appear here.",
            anchor=tk.CENTER,
            justify=tk.CENTER,
        )
        self.preview_label.pack(padx=10, pady=10)

        # Configure canvas resizing
        def _on_canvas_configure(event: tk.Event) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _on_inner_configure(event: tk.Event) -> None:
            canvas.configure(scrollregion=canvas.bbox("all"))

        canvas.bind("<Configure>", _on_canvas_configure)
        self.preview_inner_frame.bind("<Configure>", _on_inner_configure)

        self.preview_canvas = canvas

    def on_browse_clicked(self) -> None:
        """
        Browse for an input mesh file.
        """
        filetypes = [
            ("Mesh files", "*.obj *.ply *.stl *.vtp *.vtu *.vtk"),
            ("OBJ", "*.obj"),
            ("PLY", "*.ply"),
            ("STL", "*.stl"),
            ("All files", "*.*"),
        ]
        filename = filedialog.askopenfilename(
            title="Select mesh file", filetypes=filetypes
        )
        if filename:
            self.input_path_var.set(filename)
            self.status_var.set(f"Selected file: {filename}")

    def on_drop_file(self, event: tk.Event) -> None:
        """
        Handle a file dropped onto the input entry (requires tkinterdnd2).
        """
        data = str(event.data)
        # On Windows, paths with spaces may be enclosed in { } braces.
        if data.startswith("{") and data.endswith("}"):
            data = data[1:-1]

        # If multiple files were dropped, take the first one.
        if " " in data and not data.startswith('"'):
            first = data.split(" ")[0]
        else:
            first = data

        path = first.strip()
        if path:
            self.input_path_var.set(path)
            self.status_var.set(f"Dropped file: {path}")

    def on_simplify_clicked(self) -> None:
        """
        Validate input and start simplification in a background thread.
        """
        input_str = self.input_path_var.get().strip()
        if not input_str:
            messagebox.showerror("Error", "Please choose an input mesh file first.")
            return

        input_path = Path(input_str).expanduser().resolve()
        if not input_path.exists():
            messagebox.showerror("Error", f"Input file does not exist:\n{input_path}")
            return

        reduction = float(self.reduction_var.get())
        if not (0.0 < reduction < 1.0):
            messagebox.showerror(
                "Error",
                f"Reduction must be between 0.0 and 1.0 (got {reduction:.3f}).",
            )
            return

        output_path = input_path.with_name(
            f"{input_path.stem}_lowpoly{input_path.suffix}"
        )

        preserve_topology = bool(self.preserve_topology_var.get())

        self.status_var.set(
            f"Simplifying '{input_path.name}' (reduction={reduction:.2f}, "
            f"preserve_topology={preserve_topology})..."
        )

        # Run heavy work in a background thread to avoid freezing the UI
        thread = threading.Thread(
            target=self._simplify_worker,
            args=(input_path, output_path, reduction, preserve_topology),
            daemon=True,
        )
        thread.start()

    def _simplify_worker(
        self,
        input_path: Path,
        output_path: Path,
        reduction: float,
        preserve_topology: bool,
    ) -> None:
        """
        Worker thread: perform simplification and render preview.
        """
        try:
            original, simplified = simplify_mesh(
                input_path=input_path,
                output_path=output_path,
                reduction=reduction,
                preserve_topology=preserve_topology,
            )

            preview_img = render_preview_image(simplified, window_size=(800, 800))

            # Schedule UI update back on the main thread
            self.after(
                0,
                self._on_simplify_complete,
                input_path,
                output_path,
                preview_img,
            )

        except Exception as exc:
            print(f"[MeshSimplifierApp] Error during simplification: {exc}")
            self.after(0, self._on_simplify_error, exc)

    def _on_simplify_complete(
        self,
        input_path: Path,
        output_path: Path,
        preview_img: Image.Image,
    ) -> None:
        """
        Called on the main thread when simplification is complete.
        """
        self.status_var.set(
            f"Saved simplified mesh to: {output_path} "
            f"(based on '{input_path.name}')"
        )
        self.update_preview(preview_img)

    def _on_simplify_error(self, exc: Exception) -> None:
        """
        Called on the main thread if an error occurs in the worker.
        """
        messagebox.showerror(
            "Simplification Error",
            f"An error occurred while simplifying the mesh:\n{exc}",
        )
        self.status_var.set("Error occurred. See console for details.")

    def update_preview(self, image: Image.Image) -> None:
        """
        Resize and display the preview image in the GUI.
        """
        self.preview_image = image

        # Determine canvas size to scale image appropriately
        canvas_width = self.preview_canvas.winfo_width()
        canvas_height = self.preview_canvas.winfo_height()

        if canvas_width <= 1 or canvas_height <= 1:
            canvas_width, canvas_height = (600, 400)

        img_w, img_h = self.preview_image.size

        # Scale image to fit within canvas while preserving aspect ratio
        scale = min(canvas_width / img_w, canvas_height / img_h, 1.0)
        new_w = max(1, int(img_w * scale))
        new_h = max(1, int(img_h * scale))

        resized = self.preview_image.resize((new_w, new_h), Image.LANCZOS)
        self.preview_photo = ImageTk.PhotoImage(resized)

        self.preview_label.configure(image=self.preview_photo, text="")
        self.preview_label.image = self.preview_photo  # prevent GC


def main() -> None:
    app = MeshSimplifierApp()
    app.mainloop()


if __name__ == "__main__":
    main()
