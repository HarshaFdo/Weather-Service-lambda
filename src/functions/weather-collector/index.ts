import { handlerPath } from "@libs/handler-resolver";

export default {
  handler: `${handlerPath(__dirname)}/handler.main`,
  events: [
    {
      schedule: {
        rate: ["rate(1 hour)"],
        enabled: true,
      },
    },
  ],
  timeout: 300,
  memorySize: 512,
};
