import type { ValidatedEventAPIGatewayProxyEvent } from "@libs/api-gateway";
import { formatJSONResponse } from "@libs/api-gateway";
import { middyfy } from "@libs/lambda";

import schema from "./schema";
import fetch from "node-fetch";

const weather: ValidatedEventAPIGatewayProxyEvent<typeof schema> = async (
  event
) => {
  const city = event.queryStringParameters?.city || "london";
  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (!apiKey) {
    return formatJSONResponse({
      error: `api key is not configured`,
    });
  }

  const response = await fetch(
    `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${apiKey}`
  );

  if (!response.ok) {
    return formatJSONResponse({
      error: `Cannot fetch weather data for ${city}. This city may not exist.`,
    });
  }

  const weatherData = await response.json();

  if (!weatherData) {
    return formatJSONResponse({
      error: `Cannot fetch weather data for ${city}. Weather data might be unavailable.`,
    });
  }
  return formatJSONResponse({
    weatherData: weatherData,
  });
};
export const main = middyfy(weather);
