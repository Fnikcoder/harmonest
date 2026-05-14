from aws_cdk import Stack, aws_lambda as _lambda, aws_ssm as ssm
from constructs import Construct

class LayerStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        layer = _lambda.LayerVersion(
            self, "CommonLayer",
            layer_version_name=f"{client_name}-{env_name}-common-layer",
            code=_lambda.Code.from_asset("layer-src"),   # expects folder with python/...
            compatible_runtimes=[_lambda.Runtime.PYTHON_3_12, _lambda.Runtime.PYTHON_3_11],
            description=f"{config['client']['displayName']} common utilities (g4h, ddb, requests)",
        )

        ssm.StringParameter(self, "CommonLayerArn",
            parameter_name=f"/{client_name}/{env_name}/layers/commonArn",
            string_value=layer.layer_version_arn)

        # Store layer reference for other stacks
        self.layer = layer
