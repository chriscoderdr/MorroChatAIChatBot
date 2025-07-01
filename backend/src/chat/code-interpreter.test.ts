import { AgentRegistry } from "./agent-registry";

// Test the code interpreter agent with various scenarios
export const testCodeInterpreter = async () => {
  console.log("=== Testing Code Interpreter Agent ===\n");

  // Test 1: JavaScript code analysis
  const jsTest = `
What does this code do and how can I improve it?

\`\`\`javascript
var users = [];
function addUser(name) {
  users.push({name: name, id: Math.random()});
}

function getUser(id) {
  for (var i = 0; i < users.length; i++) {
    if (users[i].id == id) {
      return users[i];
    }
  }
}
\`\`\`
`;

  try {
    console.log("🔬 Test 1: JavaScript Code Analysis");
    const result1 = await AgentRegistry.callAgent('code_interpreter', jsTest, { userId: 'test-user' });
    console.log("Result:", result1.output);
    console.log("Confidence:", result1.confidence);
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Test 1 failed:", error);
  }

  // Test 2: Python code with best practices question
  const pythonTest = `
Are there any modern Python best practices I should follow for this code?

\`\`\`python
def calculate_average(numbers):
    total = 0
    for num in numbers:
        total = total + num
    return total / len(numbers)

def main():
    data = [1, 2, 3, 4, 5]
    avg = calculate_average(data)
    print("Average:", avg)

if __name__ == "__main__":
    main()
\`\`\`
`;

  try {
    console.log("🐍 Test 2: Python Best Practices Analysis");
    const result2 = await AgentRegistry.callAgent('code_interpreter', pythonTest, { userId: 'test-user' });
    console.log("Result:", result2.output);
    console.log("Confidence:", result2.confidence);
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Test 2 failed:", error);
  }

  // Test 3: Complex TypeScript with performance question
  const tsTest = `
How can I optimize this TypeScript code for better performance?

\`\`\`typescript
interface User {
  id: string;
  name: string;
  email: string;
  posts: Post[];
}

interface Post {
  id: string;
  title: string;
  content: string;
  tags: string[];
}

class UserService {
  private users: User[] = [];

  async findUsersByTag(tag: string): Promise<User[]> {
    const results: User[] = [];
    for (const user of this.users) {
      for (const post of user.posts) {
        for (const postTag of post.tags) {
          if (postTag === tag) {
            results.push(user);
            break;
          }
        }
      }
    }
    return results;
  }
}
\`\`\`
`;

  try {
    console.log("⚡ Test 3: TypeScript Performance Optimization");
    const result3 = await AgentRegistry.callAgent('code_interpreter', tsTest, { userId: 'test-user' });
    console.log("Result:", result3.output);
    console.log("Confidence:", result3.confidence);
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Test 3 failed:", error);
  }

  // Test 4: Multiple code blocks
  const multiTest = `
Compare these two sorting implementations and tell me which is better:

\`\`\`javascript
// Bubble Sort
function bubbleSort(arr) {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        let temp = arr[j];
        arr[j] = arr[j + 1];
        arr[j + 1] = temp;
      }
    }
  }
  return arr;
}
\`\`\`

\`\`\`javascript
// Quick Sort
function quickSort(arr) {
  if (arr.length <= 1) return arr;
  
  const pivot = arr[arr.length - 1];
  const left = [];
  const right = [];
  
  for (let i = 0; i < arr.length - 1; i++) {
    if (arr[i] < pivot) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }
  
  return [...quickSort(left), pivot, ...quickSort(right)];
}
\`\`\`
`;

  try {
    console.log("🔄 Test 4: Multiple Code Blocks Comparison");
    const result4 = await AgentRegistry.callAgent('code_interpreter', multiTest, { userId: 'test-user' });
    console.log("Result:", result4.output);
    console.log("Confidence:", result4.confidence);
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Test 4 failed:", error);
  }

  // Test 5: Error handling
  const noCodeTest = `
How do I fix this bug?
`;

  try {
    console.log("❌ Test 5: No Code Provided");
    const result5 = await AgentRegistry.callAgent('code_interpreter', noCodeTest, { userId: 'test-user' });
    console.log("Result:", result5.output);
    console.log("Confidence:", result5.confidence);
    console.log("\n" + "=".repeat(50) + "\n");
  } catch (error) {
    console.error("Test 5 failed:", error);
  }

  console.log("=== Code Interpreter Tests Completed ===");
};

// Example usage
// testCodeInterpreter().catch(console.error);
