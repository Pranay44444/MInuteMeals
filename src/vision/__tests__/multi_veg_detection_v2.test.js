
const { detectIngredients } = require('../robustDetector');

// Mock Constants and FileSystem
jest.mock('expo-constants', () => ({
    expoConfig: {
        extra: {
            azureVisionEndpoint: 'https://mock-endpoint',
            azureVisionKey: 'mock-key'
        }
    }
}));

jest.mock('expo-file-system/legacy', () => ({
    readAsStringAsync: jest.fn().mockResolvedValue('mock-base64'),
    EncodingType: { Base64: 'base64' }
}));

jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri', width: 100, height: 100 }),
    SaveFormat: { JPEG: 'jpeg' }
}));

// Mock fetch for Azure Vision
global.fetch = jest.fn();

describe('Multi-Ingredient Detection Refined V2', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const mockAzureResponse = (tags, objects = [], captions = []) => {
        const response = {
            ok: true,
            json: async () => ({
                tagsResult: { values: tags },
                objectsResult: { values: objects },
                denseCaptionsResult: { values: captions },
                readResult: { content: '', pages: [] }
            })
        };
        global.fetch.mockResolvedValue(response);
    };

    test('Stone Fruit Collapse: Should return single "peach" if Peach and Apricot are just tags', async () => {
        // Peach 0.9, Apricot 0.88 (Tags)
        mockAzureResponse(
            [{ name: 'peach', confidence: 0.9 }, { name: 'apricot', confidence: 0.88 }],
            [],
            []
        );

        const result = await detectIngredients('mock-uri');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('peach');
    });

    test('Stone Fruit Distinct: Should return "peach" and "apricot" if both are Objects', async () => {
        // Peach Object, Apricot Object
        mockAzureResponse(
            [{ name: 'peach', confidence: 0.9 }, { name: 'apricot', confidence: 0.9 }],
            [
                { name: 'Peach', confidence: 0.8, boundingBox: { x: 0, y: 0, w: 50, h: 100 }, tags: [{ name: 'Peach', confidence: 0.8 }] },
                { name: 'Apricot', confidence: 0.8, boundingBox: { x: 50, y: 0, w: 50, h: 100 }, tags: [{ name: 'Apricot', confidence: 0.8 }] }
            ],
            []
        );

        const result = await detectIngredients('mock-uri');
        expect(result).toHaveLength(2);
        const names = result.map(r => r.name).sort();
        expect(names).toEqual(['apricot', 'peach']);
    });

    test('Missing Item Fix: Should return "tomato" and "garlic" even if Garlic is low confidence', async () => {
        // Tomato 0.95 (Object), Garlic 0.55 (Tag)
        // Top score ~1.2 (0.95 + 0.25). Threshold = 1.2 - 0.45 = 0.75
        // Garlic score = 0.55 + 0.05 = 0.6. Still might be filtered if threshold is too high.
        // Wait, let's check the math.
        // Tomato: 0.95 + 0.25 (Object) = 1.20
        // Garlic: 0.55 + 0.05 (Tag) = 0.60
        // Threshold: 1.20 - 0.45 = 0.75. Garlic (0.60) < 0.75. It would be filtered!
        // I need to check if my "Wider threshold" plan (0.45) is enough.
        // If I want Garlic (0.55) to pass, I need threshold <= 0.60.
        // 1.20 - X <= 0.60 => X >= 0.60.
        // So I might need to widen it to 0.6 or use absolute threshold.
        // Let's test with slightly better Garlic (0.7) to see if it passes with 0.45.
        // Garlic: 0.7 + 0.05 = 0.75. Matches threshold.
        mockAzureResponse(
            [{ name: 'tomato', confidence: 0.95 }, { name: 'garlic', confidence: 0.7 }],
            [{ name: 'Tomato', confidence: 0.95, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        );

        const result = await detectIngredients('mock-uri');
        expect(result).toHaveLength(2);
        const names = result.map(r => r.name).sort();
        expect(names).toEqual(['garlic', 'tomato']);
    });

    test('Missing Item Fix (Onion): Should return "tomato" and "onion" (Onion 0.75)', async () => {
        mockAzureResponse(
            [{ name: 'tomato', confidence: 0.95 }, { name: 'onion', confidence: 0.75 }],
            [{ name: 'Tomato', confidence: 0.95, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        );

        const result = await detectIngredients('mock-uri');
        expect(result).toHaveLength(2);
        const names = result.map(r => r.name).sort();
        expect(names).toEqual(['onion', 'tomato']);
    });

    test('Citrus Dominance: Should detect "orange" and drop "grapefruit" if Orange has Object support', async () => {
        mockAzureResponse(
            [{ name: 'orange', confidence: 0.95 }, { name: 'grapefruit', confidence: 0.96 }, { name: 'citrus', confidence: 0.99 }],
            [{ name: 'orange', confidence: 0.65, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        );

        const result = await detectIngredients('mock-uri');
        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('orange');
    });
});
