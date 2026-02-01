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
    // Expect controls to be hidden initially
    await expect(page.locator('#up-btn')).not.toBeVisible();
    await expect(page.locator('#down-btn')).not.toBeVisible();
    await expect(page.locator('#subdir-input')).not.toBeVisible();
    await expect(page.locator('#current-directory-prefix')).not.toBeVisible();
    await expect(page.locator('#subdir-separator')).not.toBeVisible();

    // Fill URL input (this will cause loadImages to be called when checkbox is checked)
    await page.locator('#url-input').fill('http://localhost/mock-images/');

    // Check the "has sub-dirs" checkbox
    await page.locator('#has-subdirs').check();
    await page.waitForLoadState('networkidle'); // Wait for images to reload due to checkbox change

    // Expect controls to become visible
    await expect(page.locator('#up-btn')).toBeVisible();
    await expect(page.locator('#down-btn')).toBeVisible();
    await expect(page.locator('#subdir-input')).toBeVisible();
    await expect(page.locator('#current-directory-prefix')).toBeVisible();
    await expect(page.locator('#subdir-separator')).toBeVisible();
  });

  test('should load images from the first subdirectory when "has sub-dirs" is checked', async ({ page }) => {
    // Precondition: Use a URL with subdirectories.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#has-subdirs').check();
    await page.waitForLoadState('networkidle'); // This will trigger loadImages with subdirs

    // Expect images from the first subdir to be displayed
    // The application should automatically load the first subdirectory's images
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir1/subdir1_imageA.jpg');
    await expect(page.locator('#filename-input')).toHaveValue('subdir1_imageA.jpg');
    await expect(page.locator('#current-directory-prefix')).toHaveText('/mock-images/');
    await expect(page.locator('#subdir-input')).toHaveValue('subdir1');
  });

  test('should navigate to the next subdirectory when "Down" button is clicked', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories and "has sub-dirs" checked.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#has-subdirs').check();
    await page.waitForLoadState('networkidle'); // Ensure initial load from first subdir completes

    // Ensure we are on the first subdirectory's first image
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir1/subdir1_imageA.jpg');

    await page.locator('#down-btn').click();
    await page.waitForLoadState('networkidle'); // Wait for load from second subdir

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir2/subdir2_imageX.jpg');
    await expect(page.locator('#filename-input')).toHaveValue('subdir2_imageX.jpg');
    await expect(page.locator('#current-directory-prefix')).toHaveText('/mock-images/');
    await expect(page.locator('#subdir-input')).toHaveValue('subdir2');
  });

  test('should navigate to the previous subdirectory when "Up" button is clicked', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories and "has sub-dirs" checked.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#has-subdirs').check();
    await page.waitForLoadState('networkidle'); // Ensure initial load from first subdir completes

    // Navigate to the second subdirectory first
    await page.locator('#down-btn').click();
    await page.waitForLoadState('networkidle'); // Wait for load from second subdir
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir2/subdir2_imageX.jpg'); // Ensure second subdir is loaded

    await page.locator('#up-btn').click();
    await page.waitForLoadState('networkidle'); // Wait for load from first subdir

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir1/subdir1_imageA.jpg');
    await expect(page.locator('#filename-input')).toHaveValue('subdir1_imageA.jpg');
    await expect(page.locator('#current-directory-prefix')).toHaveText('/mock-images/');
    await expect(page.locator('#subdir-input')).toHaveValue('subdir1');
  });

  test('should search for a specific filename', async ({ page }) => {
    // Precondition: Load multiple images.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#url-form button[type="submit"]').click();
    await page.waitForLoadState('networkidle'); // Ensure initial load completes

    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image1.jpg'); // Ensure first image is loaded

    // Type a valid filename into the filename input.
    await page.locator('#filename-input').fill('image2.png');
    // Press Enter.
    await page.keyboard.press('Enter');

    // Expect the image matching the filename to be displayed.
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/image2.png');
    // Expect the filename input value to match the searched name.
    await expect(page.locator('#filename-input')).toHaveValue('image2.png');
  });

  test('should search for a specific subdirectory', async ({ page }) => {
    // Precondition: Load images from a URL with multiple subdirectories, "has sub-dirs" checked.
    await page.locator('#url-input').fill('http://localhost/mock-images/');
    await page.locator('#has-subdirs').check();
    await page.waitForLoadState('networkidle'); // Ensure initial load from first subdir completes

    // Type a valid subdirectory name into the subdir input.
    await page.locator('#subdir-input').fill('subdir2');
    // Press Enter.
    await page.keyboard.press('Enter');
    await page.waitForLoadState('networkidle'); // Wait for load from searched subdir

    // Expect images from the matching subdirectory to be displayed.
    await expect(page.locator('#image')).toHaveAttribute('src', 'http://localhost/mock-images/subdir2/subdir2_imageX.jpg');
    // Expect subdir input value to match the searched name.
    await expect(page.locator('#subdir-input')).toHaveValue('subdir2');
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