import os
import sys

def generate_icons():
    try:
        from PIL import Image, ImageDraw, ImageFilter
    except ImportError:
        print("Pillow not installed. Attempting to install...")
        import subprocess
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
        from PIL import Image, ImageDraw, ImageFilter

    # Ensure icons folder exists
    os.makedirs("icons", exist_ok=True)

    # Base canvas size for rendering high-fidelity assets
    base_size = 512
    image = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # Coordinates for smooth circle drawing
    padding = 24
    circle_box = [padding, padding, base_size - padding, base_size - padding]

    # Create background circular glow mask
    glow_image = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow_image)
    
    # Render glowing outer circle
    glow_width = 40
    for i in range(glow_width):
        alpha = int((1.0 - (i / glow_width) ** 1.5) * 80)
        box = [padding - i, padding - i, base_size - padding + i, base_size - padding + i]
        glow_draw.ellipse(box, outline=(79, 172, 254, alpha), width=3)
    
    # Blur the glow layer slightly for modern aesthetics
    glow_image = glow_image.filter(ImageFilter.GaussianBlur(15))
    image.alpha_composite(glow_image)

    # Draw the main deep obsidian circle container
    draw.ellipse(circle_box, fill=(9, 9, 11, 240))

    # Draw double border gradient using concentric ellipses
    for offset in range(8):
        alpha = int(255 - (offset * 25))
        # Fade from neon cyan (79, 172, 254) to vivid purple (161, 140, 209)
        r = int(79 + (161 - 79) * (offset / 7.0))
        g = int(172 + (140 - 172) * (offset / 7.0))
        b = int(254 + (209 - 254) * (offset / 7.0))
        draw.ellipse([padding + offset, padding + offset, base_size - padding - offset, base_size - padding - offset],
                     outline=(r, g, b, alpha), width=2)

    # Draw the premium prompt optimizer lightning bolt vector
    # Coordinate points designed for a modern, sleek tech lightning icon
    bolt_points = [
        (280, 80),   # Top point
        (170, 260),  # Left middle bend
        (255, 260),  # Inward indent left
        (220, 430),  # Bottom tip
        (340, 230),  # Right middle bend
        (255, 230),  # Inward indent right
    ]
    
    # Create high-quality glowing mask for the lightning bolt
    bolt_glow = Image.new("RGBA", (base_size, base_size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bolt_glow)
    bg_draw.polygon(bolt_points, fill=(0, 242, 254, 180))
    bolt_glow = bolt_glow.filter(ImageFilter.GaussianBlur(8))
    image.alpha_composite(bolt_glow)

    # Draw exact sharp lightning bolt on top
    draw.polygon(bolt_points, fill=(255, 255, 255, 255))
    
    # Draw minor interior highlights to give a glassy texture
    inner_highlight = [
        (275, 95),
        (190, 250),
        (255, 250),
        (235, 360),
        (280, 250),
        (255, 250),
    ]
    draw.polygon(inner_highlight, fill=(0, 242, 254, 100))

    # Resize and export to standard chrome extension icon resolutions
    sizes = [16, 32, 48, 128]
    for s in sizes:
        resized_img = image.resize((s, s), Image.Resampling.LANCZOS)
        resized_img.save(f"icons/icon{s}.png", "PNG")
        print(f"Successfully generated icons/icon{s}.png")

    # Generate a master SVG version for pristine resolution previews
    svg_content = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="70%" stop-color="#4facfe" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#a18cd1" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="neonGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#00f2fe"/>
      <stop offset="100%" stop-color="#a18cd1"/>
    </linearGradient>
    <filter id="blurFilter" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
    </filter>
  </defs>
  <!-- Ambient outer glow -->
  <circle cx="256" cy="256" r="236" fill="url(#glow)" filter="url(#blurFilter)" />
  <!-- Obsidian primary circle -->
  <circle cx="256" cy="256" r="216" fill="#09090b" stroke="url(#neonGradient)" stroke-width="8" />
  <!-- Elegant vector prompt lightning bolt -->
  <polygon points="280,80 170,260 255,260 220,430 340,230 255,230" fill="#ffffff" />
  <polygon points="275,95 190,250 255,250 235,360 280,250 255,250" fill="#00f2fe" opacity="0.4" />
</svg>"""

    with open("logo.svg", "w") as svg_file:
        svg_file.write(svg_content)
        print("Successfully generated logo.svg")

if __name__ == "__main__":
    generate_icons()
