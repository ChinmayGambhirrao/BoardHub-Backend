const mongoose = require("mongoose");
const Template = require("../models/Template");
const config = require("../config/config");

const templates = [
  {
    name: "Project Management",
    description:
      "A board for managing projects with standard workflow columns.",
    columns: ["Backlog", "In Progress", "Review", "Done"],
    cards: [
      {
        title: "Set up project repo",
        description: "Initialize repository and set up version control.",
        column: "Backlog",
      },
      {
        title: "Define requirements",
        description: "Gather and document project requirements.",
        column: "Backlog",
      },
      {
        title: "Sprint planning",
        description: "Plan the first sprint.",
        column: "Backlog",
      },
    ],
  },
  {
    name: "Personal Tasks",
    description: "A simple board for tracking personal to-dos.",
    columns: ["To Do", "Doing", "Done"],
    cards: [
      {
        title: "Buy groceries",
        description: "Milk, eggs, bread, and more.",
        column: "To Do",
      },
      {
        title: "Read a book",
        description: "Finish reading a book this week.",
        column: "To Do",
      },
      {
        title: "Exercise",
        description: "Go for a run or hit the gym.",
        column: "To Do",
      },
    ],
  },
  {
    name: "Sprint Planning",
    description: "A board for planning and tracking sprints.",
    columns: ["Sprint Backlog", "In Progress", "Testing", "Done"],
    cards: [
      {
        title: "Implement login",
        description: "Create authentication flow.",
        column: "Sprint Backlog",
      },
      {
        title: "Write unit tests",
        description: "Add tests for new features.",
        column: "Sprint Backlog",
      },
      {
        title: "Deploy to staging",
        description: "Deploy the app to the staging environment.",
        column: "Sprint Backlog",
      },
    ],
  },
  {
    name: "Student Planner",
    description: "A board for students to track assignments and grades.",
    columns: ["Assignments", "In Progress", "Submitted", "Graded"],
    cards: [
      {
        title: "Math homework",
        description: "Complete exercises 1-10.",
        column: "Assignments",
      },
      {
        title: "Science project",
        description: "Work on the volcano model.",
        column: "Assignments",
      },
      {
        title: "History essay",
        description: "Write an essay on World War II.",
        column: "Assignments",
      },
    ],
  },
];

async function seedTemplates() {
  await mongoose.connect(config.mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  for (const tpl of templates) {
    const exists = await Template.findOne({ name: tpl.name });
    if (!exists) {
      await Template.create(tpl);
      console.log(`Inserted template: ${tpl.name}`);
    } else {
      console.log(`Template already exists: ${tpl.name}`);
    }
  }
  await mongoose.disconnect();
  console.log("Seeding complete.");
}

seedTemplates().catch((err) => {
  console.error(err);
  process.exit(1);
});
