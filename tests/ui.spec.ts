import { test, expect } from '@playwright/test';
import path from 'path';

// A tiny 1x1 transparent GIF (Base64 encoded)
const TRANSPARENT_PIXEL_GIF_BASE64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

test.describe('AFI Image Viewer E2E Tests', () => {

  test.beforeEach(async ({ page }) => {
    // Navigate to the base URL before each test
    await page.goto('./');

    // Route for the mock no-images index
    await page.route('http://localhost/mock-no-images/', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            path: path.join(__dirname, 'test_data', 'mock-no-images.html'),
        });
    });

    // Route for the mock main index
    await page.route('http://localhost/mock-images/', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            path: path.join(__dirname, 'test_data', 'mock-index.html'),
        });
    });

    await page.route('http://localhost/mock-images/index.html', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            path: path.join(__dirname, 'test_data', 'mock-index.html'),
        });
    });

    // Route for subdir1 index
    await page.route('http://localhost/mock-images/subdir1/', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            path: path.join(__dirname, 'test_data', 'subdir1', 'index.html'),
        });
    });

    // Route for subdir2 index
    await page.route('http://localhost/mock-images/subdir2/', async route => {
        await route.fulfill({
            status: 200,
            contentType: 'text/html',
            path: path.join(__dirname, 'test_data', 'subdir2', 'index.html'),
        });
    });
    
    // Generic route for image files under mock-images/
    await page.route(/http:\/\/localhost\/mock-images\/.*\.(jpg|png|gif)$/, async route => {
        const imageUrl = route.request().url();
        const extension = imageUrl.split('.').pop();
        let contentType = 'application/octet-stream'; // Default
        if (extension === 'jpg') contentType = 'image/jpeg';
        else if (extension === 'png') contentType = 'image/png';
        else if (extension === 'gif') contentType = 'image/gif';

        await route.fulfill({
            status: 200,
            contentType: contentType,
            body: Buffer.from(TRANSPARENT_PIXEL_GIF_BASE64, 'base64'),
        });
    });

    // Route for a mock unreachable URL
    await page.route('http://localhost/unreachable-url/', async route => {
        await route.fulfill({
            status: 404,
            body: 'Not Found',
        });
    });


  });

  test('should display the correct title', async ({ page }) => {
    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/Apache Index Image Viewer/);
  });

  // --- Core Image Loading and Navigation ---

  test('should load images from a valid URL and display the first image', async ({ page }) => {
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();

    // Wait for the mock index to be fetched, which triggers the UI update
    await page.waitForLoadState('networkidle');

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg');
    await expect(page.locator('#image-container')).toBeVisible();
    await expect(page.locator('#filename-input')).toHaveValue('image1.jpg');
  });

  test('should navigate to the next image when "Next" button is clicked', async ({ page }) => {
    // Precondition: Load multiple images.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg'); // Ensure first image is loaded

    await page.locator('#next-btn').click();

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image2.png');
    await expect(page.locator('#filename-input')).toHaveValue('image2.png');
  });

  test('should navigate to the previous image when "Previous" button is clicked', async ({ page }) => {
    // Precondition: Load multiple images and navigate past the first one.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg'); // Ensure first image is loaded

    // Navigate to the second image first
    await page.locator('#next-btn').click();
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image2.png'); // Ensure second image is loaded

    await page.locator('#prev-btn').click();

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg');
    await expect(page.locator('#filename-input')).toHaveValue('image1.jpg');
  });

  test('should disable "Previous" button on the first image', async ({ page }) => {
    // Precondition: Load multiple images, ensure first image is displayed.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg'); // Ensure first image is loaded

    await expect(page.locator('#prev-btn')).toBeDisabled();
  });

  test('should disable "Next" button on the last image', async ({ page }) => {
    // Precondition: Load multiple images, navigate to the last image.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg'); // Ensure first image is loaded

    // Navigate to the last image (image2.png is the last in mock-index.html)
    await page.locator('#next-btn').click();
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image2.png'); // Ensure second (last) image is loaded

    await expect(page.locator('#next-btn')).toBeDisabled();
  });

  test('should display a message if no images are found for a valid URL', async ({ page }) => {
    await page.locator('#url-input').fill('http://localhost/mock-no-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#message-container')).toContainText('No images found');
    await expect(page.locator('#image-container')).not.toBeVisible();
    await expect(page.locator('#controls')).not.toBeVisible();
  });

  test('should display an error message for an invalid or unreachable URL', async ({ page }) => {
    await page.locator('#url-input').fill('http://localhost/unreachable-url/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Wait for network activity to settle after error

    await expect(page.locator('#message-container')).toContainText('Error loading images');
    await expect(page.locator('#image-container')).not.toBeVisible();
    await expect(page.locator('#controls')).not.toBeVisible();
  });

  // --- Subdirectory Functionality ---

  test('should enable subdirectory controls when "has sub-dirs" is checked', async ({ page }) => {
    // Steps:
    // 1. Check the "has sub-dirs" checkbox.
    // 2. Expect "Up" and "Down" buttons, subdir input, current directory prefix, and separator to be visible.
  });

  test('should load images from the first subdirectory when "has sub-dirs" is checked', async ({ page }) => {
    // Precondition: Use a URL with subdirectories.
    // Steps:
    // 1. Check the "has sub-dirs" checkbox.
    // 2. Enter a valid Apache index URL with subdirs.
    // 3. Click "Load Images".
    // 4. Expect images from the first subdir to be displayed.
    // 5. Expect subdir input and prefix to show the first subdir.
  });

  test('should navigate to the next subdirectory when "Down" button is clicked', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories.
    // Steps:
    // 1. Click "Down" button.
    // 2. Expect images from the next subdir to be displayed.
    // 3. Expect subdir input and prefix to update.
  });

  test('should navigate to the previous subdirectory when "Up" button is clicked', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories and navigated down at least once.
    // Steps:
    // 1. Click "Up" button.
    // 2. Expect images from the previous subdir to be displayed.
    // 3. Expect subdir input and prefix to update.
  });

  test('should search for a specific filename', async ({ page }) => {
    // Precondition: Load multiple images.
    // Steps:
    // 1. Type a valid filename into the filename input.
    // 2. Press Enter.
    // 3. Expect the image matching the filename to be displayed.
    // 4. Expect the filename input value to match the searched name.
  });

  test('should search for a specific subdirectory', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories, "has sub-dirs" checked.
    // Steps:
    // 1. Type a valid subdirectory name into the subdir input.
    // 2. Press Enter.
    // 3. Expect images from the matching subdirectory to be displayed.
    // 4. Expect subdir input value to match the searched name.
  });

  // --- Keyboard Navigation ---
  test('should navigate next/previous image using arrow keys', async ({ page }) => {
    // Precondition: Load multiple images.
    // Steps:
    // 1. Press 'ArrowRight'. Expect next image.
    // 2. Press 'ArrowLeft'. Expect previous image.
  });

  test('should navigate up/down subdirectories using arrow keys', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories, "has sub-dirs" checked.
    // Steps:
    // 1. Press 'ArrowDown'. Expect next subdir.
    // 2. Press 'ArrowUp'. Expect previous subdir.
  });

});