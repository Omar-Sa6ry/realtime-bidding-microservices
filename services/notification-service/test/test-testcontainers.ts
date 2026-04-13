import { GenericContainer } from "testcontainers";

async function test() {
    console.log("Testing Testcontainers...");
    try {
        const container = await new GenericContainer("alpine")
            .withCommand(["sleep", "10"])
            .start();
        console.log("Container started successfully!");
        await container.stop();
        console.log("Container stopped successfully!");
    } catch (err) {
        console.error("Testcontainers failed:", err);
    }
}

test();
