import { DynamicStructuredTool } from '@langchain/core/tools';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';

export const createOpenWeatherMapTool = (configService: ConfigService) => {
  return new DynamicStructuredTool({
    name: 'open_weather_map',
    description: 'Provides the current weather for a single, specific city.',
    schema: z.object({
      location: z
        .string()
        .describe("The city and country, e.g., 'Santo Domingo, DO'."),
    }),
    func: async ({ location }: { location: string }) => {
      if (!location || location.trim().length === 0) {
        return 'Please provide a valid location to check the weather.';
      }

      const apiKey = configService.get<string>('OPENWEATHER_API_KEY');
      if (!apiKey) return 'OpenWeatherMap API key is missing.';

      try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(
          location,
        )}&limit=1&appid=${apiKey}`;
        const geoRes = await fetch(geoUrl);
        if (!geoRes.ok)
          return `Could not find location data for ${location}. API returned error ${geoRes.status}.`;

        const geoData = await geoRes.json();
        if (!geoData || geoData.length === 0)
          return `Could not find location data for ${location}. Please try with a more specific location.`;

        const { lat, lon, name, country } = geoData[0];
        const weatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&appid=${apiKey}&lang=es`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok)
          return `Failed to fetch weather. API returned error ${weatherRes.status}.`;

        const weatherData = await weatherRes.json();
        const { temp, feels_like, humidity } = weatherData.main;
        const description = weatherData.weather[0].description;
        const windSpeed = weatherData.wind?.speed || 'N/A';

        return `Current weather in ${name}, ${country}: ${description}. Temp: ${temp}°C (feels like ${feels_like}°C). Humidity: ${humidity}%. Wind speed: ${windSpeed} m/s.`;
      } catch (error) {
        return `An error occurred while fetching weather for ${location}. Please try again with a more specific location.`;
      }
    },
  });
};
