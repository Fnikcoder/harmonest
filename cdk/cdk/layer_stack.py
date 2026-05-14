from aws_cdk import BundlingOptions, Stack, aws_lambda as _lambda, aws_ssm as ssm
from constructs import Construct


class LayerStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        skip_ctx = self.node.try_get_context("skipLayerDocker")
        skip_docker = skip_ctx is True or str(skip_ctx or "").lower() in ("1", "true", "yes")

        if skip_docker:
            layer_code = _lambda.Code.from_asset("layer-src")
        else:
            layer_code = _lambda.Code.from_asset(
                "layer-src",
                bundling=BundlingOptions(
                    image=_lambda.Runtime.PYTHON_3_12.bundling_image,
                    # Default CDK uses uid 1000; pip upgrade then tries to write /.local -> Permission denied.
                    user="root",
                    environment={
                        "PIP_ROOT_USER_ACTION": "ignore",
                    },
                    command=[
                        "bash",
                        "-c",
                        "set -euo pipefail && "
                        "rm -rf /asset-output/python && mkdir -p /asset-output/python && "
                        "cp -r /asset-input/python/common /asset-output/python/common && "
                        "python -m pip install --no-cache-dir -r /asset-input/python/requirements.txt "
                        "-t /asset-output/python "
                        "--platform manylinux2014_x86_64 --python-version 3.12 --implementation cp "
                        "--only-binary=:all: "
                        "|| python -m pip install --no-cache-dir -r /asset-input/python/requirements.txt "
                        "-t /asset-output/python "
                        "--platform manylinux2014_x86_64 --python-version 3.12 --implementation cp",
                    ],
                ),
            )

        layer = _lambda.LayerVersion(
            self,
            "CommonLayer",
            layer_version_name=f"{client_name}-{env_name}-common-layer",
            code=layer_code,
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12, _lambda.Runtime.PYTHON_3_11],
            description=f"{config['client']['displayName']} common utilities (g4h, ddb, requests)",
        )

        ssm.StringParameter(
            self,
            "CommonLayerArn",
            parameter_name=f"/{client_name}/{env_name}/layers/commonArn",
            string_value=layer.layer_version_arn,
        )

        self.layer = layer
