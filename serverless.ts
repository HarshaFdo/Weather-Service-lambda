import type { AWS } from "@serverless/typescript";

import hello from "@functions/hello";
import weatherCollector from "@functions/weather-collector";

const serverlessConfiguration: AWS = {
  service: "hello-weather",
  frameworkVersion: "3",
  plugins: ["serverless-esbuild", "serverless-domain-manager"],
  provider: {
    name: "aws",
    runtime: "nodejs20.x",
    apiGateway: {
      minimumCompressionSize: 1024,
      shouldStartNameWithService: true,
    },
    environment: {
      NAME: "hello-weather",
      OPENWEATHER_API_KEY: "82fb6c52721b1f07a8d05d045995b1a3",
      S3_BUCKET_NAME: "weatherdata-2025",
      AWS_NODEJS_CONNECTION_REUSE_ENABLED: "1",
      NODE_OPTIONS: "--enable-source-maps --stack-trace-limit=1000",
    },
    iam: {
      role: {
        statements: [
          {
            Effect: "Allow",
            Action: [
              "s3:GetObject",
              "s3:PutObject",
              "s3:ListBucket"
            ],
            Resource: [
              "arn:aws:s3:::weatherdata-2025",
              "arn:aws:s3:::weatherdata-2025/*"
            ]
          }
        ]
      }
    }
  },
  
  // import the function via paths
  functions: { 
    hello,
    weatherCollector
  },
  package: { individually: true },
  custom: {
    customDomain: {
      domainName: "weather.harshafdo.online",
      certificateName: "*.harshafdo.online",
      basePath: "",
      createRoute53Record: true,
      endpointType: "REGIONAL",
      autoDomain: false,
    },
    esbuild: {
      bundle: true,
      minify: false,
      sourcemap: true,
      exclude: ["aws-sdk"],
      target: "node20",
      define: { "require.resolve": undefined },
      platform: "node",
      concurrency: 10,
    },
  },
};

module.exports = serverlessConfiguration;
