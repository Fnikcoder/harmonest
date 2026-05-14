from aws_cdk import (
    Stack, RemovalPolicy,
    aws_dynamodb as ddb,
    aws_ssm as ssm,
)
from constructs import Construct


class CoreStack(Stack):
    def __init__(self, scope: Construct, cid: str, *, config: dict, **kw):
        super().__init__(scope, cid, **kw)

        # Extract configuration values
        client_name = config["cdk"]["client_name"]
        env_name = config["cdk"]["env_name"]

        # Generate table name using client configuration
        if env_name == "prod":
            table_name = f"{client_name}-main"
        else:
            table_name = f"{client_name}-{env_name}-main"

        # Single-table design: PK/SK; on-demand (PAY_PER_REQUEST), PITR on, and retain on stack delete
        table = ddb.Table(
            self, "AppTable",
            table_name=table_name,
            partition_key=ddb.Attribute(name="PK", type=ddb.AttributeType.STRING),
            sort_key=ddb.Attribute(name="SK", type=ddb.AttributeType.STRING),
            billing_mode=ddb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True,
            removal_policy=RemovalPolicy.RETAIN,
        )

        # Add GSIs exactly as in the script: GSI1..GSI4 with GSIxPK / GSIxSK
        gsi_defs = {
            "GSI1": ("GSI1PK", "GSI1SK"),
            "GSI2": ("GSI2PK", "GSI2SK"),
            "GSI3": ("GSI3PK", "GSI3SK"),
            "GSI4": ("GSI4PK", "GSI4SK"),
        }
        for name, (pk, sk) in gsi_defs.items():
            table.add_global_secondary_index(
                index_name=name,
                partition_key=ddb.Attribute(name=pk, type=ddb.AttributeType.STRING),
                sort_key=ddb.Attribute(name=sk, type=ddb.AttributeType.STRING),
                projection_type=ddb.ProjectionType.ALL,  # matches CLI's ProjectionType: ALL
            )

        # Add GSI for reservationCode lookup (for check-in functionality)
        table.add_global_secondary_index(
            index_name="ReservationCodeIndex",
            partition_key=ddb.Attribute(name="reservationCode", type=ddb.AttributeType.STRING),
            projection_type=ddb.ProjectionType.ALL,
        )

        # # TTL attribute (epoch seconds) for expiry/cleanup
        # table.add_time_to_live(attribute_name="ttl")

        # Publish table name for other stacks / lambdas
        ssm.StringParameter(
            self, "AppTableName",
            parameter_name=f"/{client_name}/{env_name}/table/name",
            string_value=table.table_name,
        )

        # Store table reference for other stacks
        self.table = table
