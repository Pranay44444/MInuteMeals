const { detectIngredients } = require('../robustDetector')

jest.mock('expo-constants', () => ({
    expoConfig: { extra: { azureVisionEndpoint: 'https://mock-endpoint', azureVisionKey: 'mock-key' } }
}))

jest.mock('expo-file-system/legacy', () => ({
    readAsStringAsync: jest.fn().mockResolvedValue('mock-base64'),
    EncodingType: { Base64: 'base64' }
}), { virtual: true })

jest.mock('expo-image-manipulator', () => ({
    manipulateAsync: jest.fn().mockResolvedValue({ uri: 'mock-uri', width: 100, height: 100 }),
    SaveFormat: { JPEG: 'jpeg' }
}))

global.fetch = jest.fn()

describe('Multi-Ingredient Detection V2', () => {
    beforeEach(() => jest.clearAllMocks())

    const mockAzure = (tags, objects = [], captions = []) => {
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                tagsResult: { values: tags },
                objectsResult: { values: objects },
                denseCaptionsResult: { values: captions },
                readResult: { content: '', pages: [] }
            })
        })
    }

    test('Stone Fruit Collapse: single peach if both are tags', async () => {
        mockAzure([{ name: 'peach', confidence: 0.9 }, { name: 'apricot', confidence: 0.88 }], [], [])
        const result = await detectIngredients('mock-uri')
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('peach')
    })

    test('Stone Fruit Distinct: both peach and apricot if Objects', async () => {
        mockAzure(
            [{ name: 'peach', confidence: 0.9 }, { name: 'apricot', confidence: 0.9 }],
            [
                { name: 'Peach', confidence: 0.8, boundingBox: { x: 0, y: 0, w: 50, h: 100 }, tags: [{ name: 'Peach', confidence: 0.8 }] },
                { name: 'Apricot', confidence: 0.8, boundingBox: { x: 50, y: 0, w: 50, h: 100 }, tags: [{ name: 'Apricot', confidence: 0.8 }] }
            ],
            []
        )
        const result = await detectIngredients('mock-uri')
        expect(result).toHaveLength(2)
        expect(result.map(r => r.name).sort()).toEqual(['apricot', 'peach'])
    })

    test('Missing Item: tomato and garlic even if garlic is low confidence', async () => {
        mockAzure(
            [{ name: 'tomato', confidence: 0.95 }, { name: 'garlic', confidence: 0.7 }],
            [{ name: 'Tomato', confidence: 0.95, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        )
        const result = await detectIngredients('mock-uri')
        expect(result).toHaveLength(2)
        expect(result.map(r => r.name).sort()).toEqual(['garlic', 'tomato'])
    })

    test('Missing Item: tomato and onion', async () => {
        mockAzure(
            [{ name: 'tomato', confidence: 0.95 }, { name: 'onion', confidence: 0.75 }],
            [{ name: 'Tomato', confidence: 0.95, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        )
        const result = await detectIngredients('mock-uri')
        expect(result).toHaveLength(2)
        expect(result.map(r => r.name).sort()).toEqual(['onion', 'tomato'])
    })

    test('Citrus Dominance: orange over grapefruit if orange has Object support', async () => {
        mockAzure(
            [{ name: 'orange', confidence: 0.95 }, { name: 'grapefruit', confidence: 0.96 }, { name: 'citrus', confidence: 0.99 }],
            [{ name: 'orange', confidence: 0.65, boundingBox: { x: 0, y: 0, w: 100, h: 100 } }],
            []
        )
        const result = await detectIngredients('mock-uri')
        expect(result).toHaveLength(1)
        expect(result[0].name).toBe('orange')
    })
})
