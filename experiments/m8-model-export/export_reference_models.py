"""Reproducibly export M8's pinned reference model weights to ONNX.

Run from the repository root:
  . experiments/m8-model-export/.venv/bin/activate
  python experiments/m8-model-export/export_reference_models.py
"""

from pathlib import Path
import importlib.util
import json
import sys
import urllib.request

import onnx
import torch
from torchvision.models import mobilenet_v3_large

ROOT = Path(__file__).resolve().parents[2]
WORKSPACE = ROOT / "experiments" / "m8-model-export"
ARTIFACTS = WORKSPACE / "artifacts"
OUTPUT = ROOT / "assets" / "scientific" / "models"
U2NET_SOURCE = WORKSPACE / "u2net-source" / "model" / "u2net.py"


class U2NetPrimaryOutput(torch.nn.Module):
    """U2-Net emits seven side outputs; M8 uses the primary saliency output."""

    def __init__(self, model):
        super().__init__()
        self.model = model

    def forward(self, image):
        return self.model(image)[0]


def load_u2netp():
    spec = importlib.util.spec_from_file_location("gather_u2net", U2NET_SOURCE)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    model = module.U2NETP(3, 1)
    model.load_state_dict(torch.load(ARTIFACTS / "u2netp.pth", map_location="cpu", weights_only=True))
    model.eval()
    return U2NetPrimaryOutput(model).eval()


def export(model, output, input_size, output_name):
    sample = torch.zeros((1, 3, input_size, input_size), dtype=torch.float32)
    with torch.no_grad():
        torch.onnx.export(
            model,
            sample,
            output,
            input_names=["image"],
            output_names=[output_name],
            opset_version=17,
            do_constant_folding=True,
            dynamo=False,
        )
    graph = onnx.load(output)
    onnx.checker.check_model(graph)


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    export(load_u2netp(), OUTPUT / "u2netp.onnx", 320, "saliency")

    mobile = mobilenet_v3_large(weights=None)
    state = torch.load(ARTIFACTS / "mobilenet_v3_large-5c1a4163.pth", map_location="cpu", weights_only=True)
    mobile.load_state_dict(state)
    mobile.eval()
    export(mobile, OUTPUT / "mobilenet-v3-large-imagenet1k-v2.onnx", 224, "logits")

    metadata = {
        "torch": torch.__version__,
        "torchvision": __import__("torchvision").__version__,
        "onnx": onnx.__version__,
        "opset": 17,
        "u2netpInput": [1, 3, 320, 320],
        "mobilenetInput": [1, 3, 224, 224],
    }
    (OUTPUT / "export-metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    labels_url = "https://raw.githubusercontent.com/pytorch/hub/master/imagenet_classes.txt"
    labels = urllib.request.urlopen(labels_url).read().decode("utf-8").splitlines()
    if len(labels) != 1000:
        raise RuntimeError(f"Expected 1000 ImageNet labels, got {len(labels)}")
    (OUTPUT / "imagenet-1k-labels.txt").write_text("\n".join(labels) + "\n")


if __name__ == "__main__":
    main()
