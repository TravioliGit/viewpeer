import * as Model from '../model.js';

let getData, accData, testData;

describe('Testing model.js for client connections and range of function/input types:', () => {
  test('1. Testing if psql client connects', () => {
    expect(Model.psql).not.toBeNull();
  });
  //testing for expected output
  test('2. Testing query function with no input', () => {
    getData = await Model.getAreas();
    accData = ['Physics', 'Chemistry', 'English Literature', 'Biology', 'Psychology', 'Education and Teaching']
    await storage.uploadlevel(testData);
    const newDatabase = await storage.getlevels();
    expect(newDatabase).not.toBe(levelData);
  });
});
