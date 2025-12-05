import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import fetch from "node-fetch";

const s3Client = new S3Client({});

// Helper function to convert stream to string
async function streamToString(stream: any): Promise<string> {
  const chunks: Uint8Array[] = [];
  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Uint8Array) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

// Read cities from S3 CSV file
async function getCitiesFromS3(bucketName: string): Promise<string[]> {
  console.log(`Reading cities from S3 bucket: ${bucketName}`);
  
  const command = new GetObjectCommand({
    Bucket: bucketName,
    Key: 'cities.csv',
  });

  const response = await s3Client.send(command);
  const csvContent = await streamToString(response.Body);
  
  // Parse CSV - skip header row and extract city names
  const lines = csvContent.trim().split('\n');
  const cities = lines.slice(1).map(line => line.trim()).filter(city => city.length > 0);
  
  console.log(`Found ${cities.length} cities:`, cities);
  return cities;
}

// Get the current index (which city to process next)
async function getCurrentIndex(bucketName: string): Promise<number> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: 'current-index.json',
    });
    
    const response = await s3Client.send(command);
    const content = await streamToString(response.Body);
    const data = JSON.parse(content);
    
    return data.index || 0;
  } catch (error) {
    // File doesn't exist yet, start from 0
    console.log('No index file found, starting from 0');
    return 0;
  }
}

// Save the next index
async function saveNextIndex(bucketName: string, nextIndex: number): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: 'current-index.json',
    Body: JSON.stringify({ index: nextIndex }),
    ContentType: 'application/json',
  });
  
  await s3Client.send(command);
}

// Fetch weather data for a single city from your API
async function getWeatherForCity(city: string): Promise<any> {
  console.log(`Fetching weather for: ${city}`);
  
  const url = `https://weather.harshafdo.online/?city=${encodeURIComponent(city)}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`HTTP error for ${city}! status: ${response.status}`);
  }
  
  const data = await response.json();
  
  return {
    city: city,
    weatherData: data,
    fetchedAt: new Date().toISOString(),
  };
}

// Save weather data for ONE city to S3
async function saveWeatherDataToS3(
  bucketName: string,
  weatherData: any
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const cityName = weatherData.city.replace(/\s+/g, '-'); // Replace spaces with dashes
  const fileName = `weather-${cityName}-${timestamp}.json`;
  
  console.log(`Saving weather data to S3: ${fileName}`);
  
  const command = new PutObjectCommand({
    Bucket: bucketName,
    Key: fileName,
    Body: JSON.stringify(weatherData, null, 2),
    ContentType: 'application/json',
  });

  await s3Client.send(command);
  console.log(`Successfully saved weather data to ${fileName}`);
  
  return fileName;
}

export const main = async (event: any) => {
  console.log('Weather collector Lambda triggered', JSON.stringify(event, null, 2));
  
  const bucketName = process.env.S3_BUCKET_NAME;

  if (!bucketName) {
    throw new Error('S3_BUCKET_NAME environment variable is not set');
  }

  try {
    // Step 1: Read all cities from S3
    const cities = await getCitiesFromS3(bucketName);
    
    if (cities.length === 0) {
      throw new Error('No cities found in CSV file');
    }
    
    // Step 2: Get the current index (which city to process)
    const currentIndex = await getCurrentIndex(bucketName);
    
    // Step 3: Calculate which city to process (wrap around if needed)
    const cityIndex = currentIndex % cities.length;
    const cityToProcess = cities[cityIndex];
    
    console.log(`Processing city ${cityIndex + 1} of ${cities.length}: ${cityToProcess}`);
    
    // Step 4: Fetch weather data for THIS ONE city
    const weatherData = await getWeatherForCity(cityToProcess);
    
    // Step 5: Save the data to S3
    const fileName = await saveWeatherDataToS3(bucketName, weatherData);
    
    // Step 6: Update the index for next invocation
    const nextIndex = currentIndex + 1;
    await saveNextIndex(bucketName, nextIndex);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Weather data collection completed successfully',
        cityProcessed: cityToProcess,
        cityIndex: cityIndex + 1,
        totalCities: cities.length,
        fileName: fileName,
        nextCity: cities[nextIndex % cities.length],
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    console.error('Error in weather collection:', error);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error collecting weather data',
        error: error.message,
      }),
    };
  }
};