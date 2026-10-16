"""Render supplied experiment summaries, not new measurements.

Requires Python 3 and matplotlib. No per-trial data were supplied, so no
error bars or statistical significance claims are generated.
"""
from pathlib import Path
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

OUT = Path(__file__).resolve().parents[1] / "images" / "shashtable"
OUT.mkdir(parents=True, exist_ok=True)
BLUE, RED, GREEN, GRAY = "#16729A", "#C74748", "#24805C", "#78818B"
plt.rcParams.update({
    "font.family": "DejaVu Sans", "font.size": 13,
    "axes.spines.top": False, "axes.spines.right": False,
    "axes.labelcolor": "#263238", "text.color": "#263238",
    "axes.edgecolor": "#B5BEC4", "figure.facecolor": "white",
    "savefig.facecolor": "white", "axes.axisbelow": True,
})

def save(fig, name):
    fig.savefig(OUT / name, dpi=190, bbox_inches="tight", pad_inches=0.2)
    plt.close(fig)

def grid(ax, axis="x"):
    ax.grid(axis=axis, color="#E4E8EB", linewidth=0.8)
    ax.tick_params(length=0)

def box(ax, xy, width, height, text, color):
    ax.add_patch(FancyBboxPatch(xy, width, height,
        boxstyle="round,pad=0.01,rounding_size=0.012",
        linewidth=1.2, edgecolor=color, facecolor="white"))
    ax.text(xy[0] + width / 2, xy[1] + height / 2, text,
            ha="center", va="center", fontsize=14)

fig, ax = plt.subplots(figsize=(10, 7.3))
ax.set(xlim=(0, 1), ylim=(0, 1))
ax.axis("off")
ax.set_title("SHashTable: 64-byte key path", fontsize=20, pad=16)
box(ax, (0.16, 0.79), 0.68, 0.13,
    "Public API\ng_hash_table_*  ->  s_hash_table_*", BLUE)
box(ax, (0.16, 0.55), 0.68, 0.16,
    "64-byte key -> SipHash-1-4 -> 64-bit result\nXOR fold -> 32-bit hash -> home bucket", GREEN)
box(ax, (0.03, 0.30), 0.44, 0.14, "meta[i]\ncached hash | PSL", BLUE)
box(ax, (0.53, 0.30), 0.44, 0.14, "entries[i]\nkey pointer | value pointer", RED)
box(ax, (0.16, 0.06), 0.68, 0.15,
    "Robin Hood linear probing\nMetadata check -> key equality -> value", GREEN)
for start, end in [((0.5, 0.78), (0.5, 0.72)),
                   ((0.5, 0.54), (0.25, 0.45)),
                   ((0.25, 0.29), (0.35, 0.22)),
                   ((0.75, 0.29), (0.65, 0.22))]:
    ax.annotate("", xy=end, xytext=start,
                arrowprops={"arrowstyle": "->", "color": GRAY, "lw": 1.5})
ax.text(0.5, 0.37, "i", ha="center", va="center", color=GRAY)
save(fig, "architecture.png")

labels = ["logging", "string", "legacy", "jhash"]
colors = [BLUE, GREEN, GRAY, RED]
fig, axes = plt.subplots(2, 1, figsize=(9, 8.6), layout="constrained")
for ax, values, xlabel, bound in [
    (axes[0], [16.0009, 16.0009, 13.2336, 15.9993],
     "Mean changed output bits (32-bit output)", 32),
    (axes[1], [0.0197, 0.0197, 0.5000, 0.0292],
     "Maximum SAC bias (closer to 0 is better)", 0.56),
]:
    ax.barh(labels, values, color=colors, height=0.55)
    ax.invert_yaxis()
    ax.set(xlabel=xlabel, xlim=(0, bound))
    for i, value in enumerate(values):
        ax.text(value + bound * 0.015, i, f"{value:.4f}", va="center", fontsize=12,
                bbox={"facecolor": "white", "edgecolor": "none", "pad": 1}, zorder=4)
    grid(ax)
axes[0].axvline(16, color="#263238", ls="--", lw=1.1, label="Ideal mean: 16")
axes[0].legend(loc="lower right", frameon=False)
fig.suptitle("Bit diffusion | 64-byte input", fontsize=19)
save(fig, "avalanche.png")

fig, ax = plt.subplots(figsize=(9, 4.6), layout="constrained")
values = [20.20, 22.08, 40.70, 19.85]
ax.barh(labels, values, color=colors, height=0.55)
ax.invert_yaxis()
ax.set(xlabel="Median ns/hash (lower is better)", xlim=(0, 47),
       title="Hash cost | 64-byte random keys")
for i, v in enumerate(values):
    ax.text(v + 0.6, i, f"{v:.2f}", va="center")
grid(ax)
save(fig, "hash-cost.png")

loads = [25, 50, 70, 75]
fig, axes = plt.subplots(2, 1, figsize=(9, 8.2), layout="constrained")
for ax, title, logging, jhash in [
    (axes[0], "Random keys", [0.167, 0.501, 1.184, 1.515], [0.168, 0.504, 1.165, 1.487]),
    (axes[1], "Sequential keys", [0.164, 0.492, 1.152, 1.486], [0.173, 0.514, 1.168, 1.520]),
]:
    ax.plot(loads, logging, "o-", color=BLUE, lw=2, markersize=8, label="logging")
    ax.plot(loads, jhash, "s--", color=RED, lw=2, markersize=7,
            markerfacecolor="white", label="jhash")
    ax.set(title=title, xlabel="Table occupancy (%)", ylabel="Mean PSL",
           xticks=loads, xlim=(22, 78), ylim=(0, 1.7))
    ax.legend(loc="upper left", frameon=False)
    grid(ax, "y")
fig.suptitle("Probe distance | 262,144 slots, 64-byte keys", fontsize=18)
save(fig, "probe-distance.png")

fig, ax = plt.subplots(figsize=(9, 5.8), layout="constrained")
operations = ["Insert (fill 0-75%)", "Hit lookup", "Miss lookup"]
for offset, values, color, label in [
    (-0.18, [43.59, 205.09, 96.11], BLUE, "logging"),
    (0.18, [45.50, 206.67, 90.41], RED, "jhash"),
]:
    positions = [i + offset for i in range(3)]
    ax.barh(positions, values, height=0.30, color=color, label=label)
    for y, v in zip(positions, values):
        ax.text(v + 3, y, f"{v:.2f}", va="center", fontsize=12)
ax.set(yticks=range(3), yticklabels=operations, xlim=(0, 245),
       xlabel="Median ns/op across 5 runs (lower is better)",
       title="SHashTable API cost | 64-byte random keys")
ax.invert_yaxis()
ax.legend(loc="lower right", frameon=False)
grid(ax)
save(fig, "table-cost.png")
print(f"Rendered 5 figures in {OUT}")
