// Starter question sets. Admin → Questions → “Add a starter set” copies one into your account.
// Generated file: edit the sets in the app, not here.
export const STARTER_SETS = [
 {
  "title": "JS + React Test",
  "description": "The original 27 questions: destructuring, props, state, fetch, useEffect, lists, the terminal, and debugging.",
  "minutes": 45,
  "points": 1,
  "hintPenalty": 0.5,
  "sections": [
   {
    "id": "s1",
    "title": "Multiple choice"
   },
   {
    "id": "s2",
    "title": "Fill in the blanks"
   },
   {
    "id": "s3",
    "title": "Write the code"
   },
   {
    "id": "s4",
    "title": "Debugging"
   }
  ],
  "questions": [
   {
    "id": "a1",
    "section": "s1",
    "type": "mcq",
    "title": "Destructuring an object",
    "prompt": "What is `price` after this line?",
    "code": "const { name, price } = { name: \"Dosa\", price: 60, veg: true };",
    "codeLang": "js",
    "options": [
     "`undefined`",
     "`60`",
     "`\"price\"`",
     "`{ price: 60 }`"
    ],
    "answer": 1,
    "hint": "Destructuring pulls out each property by its name."
   },
   {
    "id": "a2",
    "section": "s1",
    "type": "mcq",
    "title": "A property that isn’t there",
    "prompt": "What is `cost` after this line?",
    "code": "const { cost } = { name: \"Vada\", price: 30 };",
    "codeLang": "js",
    "options": [
     "`undefined`",
     "`30`",
     "`\"cost\"`",
     "An error stops the code"
    ],
    "answer": 0,
    "hint": "Is there a property called cost in that object? JavaScript doesn’t complain about missing ones."
   },
   {
    "id": "a3",
    "section": "s1",
    "type": "mcq",
    "title": "Reading a prop",
    "prompt": "A parent renders `<ProductItem title=\"Pen\" price={20} />`. Which `ProductItem` shows the price correctly?",
    "code": "",
    "codeLang": "js",
    "options": [
     "`function ProductItem(price) { return <p>{price}</p>; }`",
     "`function ProductItem({ props }) { return <p>{props}</p>; }`",
     "`function ProductItem() { return <p>{price}</p>; }`",
     "`function ProductItem({ price }) { return <p>{price}</p>; }`"
    ],
    "answer": 3,
    "hint": "All the props arrive as ONE object. The curly brackets inside the round brackets unpack it."
   },
   {
    "id": "a4",
    "section": "s1",
    "type": "mcq",
    "title": "Naming a component",
    "prompt": "Which name can be used as a component, like `<___ />`?",
    "code": "",
    "codeLang": "js",
    "options": [
     "`ProductCard`",
     "`productCard`",
     "`product-card`",
     "`product_card`"
    ],
    "answer": 0,
    "hint": "React treats a tag that starts with a lowercase letter as a plain HTML tag."
   },
   {
    "id": "a5",
    "section": "s1",
    "type": "mcq",
    "title": "What the setter is",
    "prompt": "In `const [count, setCount] = useState(0);` what is `setCount`?",
    "code": "",
    "codeLang": "js",
    "options": [
     "The number 0",
     "A copy of `count`",
     "A function that changes `count` and makes React draw the component again",
     "A variable you can change with `setCount = 5`"
    ],
    "answer": 2,
    "hint": "Only one of these can be called like this: setCount(1)."
   },
   {
    "id": "a6",
    "section": "s1",
    "type": "mcq",
    "title": "Changing state the wrong way",
    "prompt": "A button runs `count = count + 1;` instead of `setCount(count + 1);`. What happens on the page?",
    "code": "",
    "codeLang": "js",
    "options": [
     "The number goes up by 1",
     "Nothing changes on the page (and with const, the console shows an error)",
     "The number goes up by 2",
     "The page reloads"
    ],
    "answer": 1,
    "hint": "React only draws the component again when you call the setter."
   },
   {
    "id": "a7",
    "section": "s1",
    "type": "mcq",
    "title": "Loading data when the page opens",
    "prompt": "You want to load products from the API once, when a component first appears on the page. Which hook do you put the `fetch` in?",
    "code": "",
    "codeLang": "js",
    "options": [
     "`useState`",
     "`useEffect`",
     "`useFetch`",
     "`useData`"
    ],
    "answer": 1,
    "hint": "useState only stores a value. The hook you need runs code after the component appears on the page."
   },
   {
    "id": "a8",
    "section": "s1",
    "type": "mcq",
    "title": "What fetch does",
    "prompt": "What does this line do?",
    "code": "fetch(\"https://dummyjson.com/products\");",
    "codeLang": "js",
    "options": [
     "Turns a JavaScript object into text",
     "Draws a list of products on the page",
     "Saves the products inside the browser",
     "Asks a server for data over the internet"
    ],
    "answer": 3,
    "hint": "Look at the link inside the brackets. Where do those products live?"
   },
   {
    "id": "a9",
    "section": "s1",
    "type": "mcq",
    "title": "What .json() does",
    "prompt": "What does `response.json()` do after a `fetch`?",
    "code": "",
    "codeLang": "js",
    "options": [
     "Sends the data to the server as JSON",
     "Saves the reply to a file on the laptop",
     "Turns the reply into a JavaScript object",
     "Checks that the internet is working"
    ],
    "answer": 2,
    "hint": "The reply arrives as text. Something has to read it into an object you can use."
   },
   {
    "id": "a10",
    "section": "s1",
    "type": "mcq",
    "title": "A value inside an object",
    "prompt": "Which line puts `4.5` in a variable called `stars`?",
    "code": "const dish = {\n  name: \"Masala dosa\",\n  price: 60,\n  rating: { stars: 4.5, votes: 120 },\n};",
    "codeLang": "js",
    "options": [
     "`const { stars } = dish.rating;`",
     "`const { stars } = dish;`",
     "`const { rating } = dish.stars;`",
     "`const stars = dish.stars;`"
    ],
    "answer": 0,
    "hint": "stars is not directly inside dish. It is inside dish.rating."
   },
   {
    "id": "b1",
    "section": "s2",
    "type": "blanks",
    "title": "Destructuring",
    "prompt": "Fill in the blanks so the console shows `Kavya C`.",
    "code": "const student = { name: \"Kavya\", roll: 21, block: \"C\" };\nconst { __1__, __2__ } = student;\nconsole.log(name, block);   // Kavya C",
    "lang": "js",
    "anyOrder": true,
    "blanks": [
     {
      "n": 1,
      "accept": [
       "name",
       "block"
      ]
     },
     {
      "n": 2,
      "accept": [
       "name",
       "block"
      ]
     }
    ],
    "hint": "The names in the curly brackets must match the object’s property names exactly."
   },
   {
    "id": "b2",
    "section": "s2",
    "type": "blanks",
    "title": "Props",
    "prompt": "The parent writes `<ProductItem title=\"Pen\" price={20} />`. Fill in the blanks so the page shows `Pen: ₹20`.",
    "code": "function ProductItem(__3__) {\n  return <li>{title}: ₹{__4__}</li>;\n}",
    "lang": "js",
    "anyOrder": false,
    "blanks": [
     {
      "n": 3,
      "accept": [
       "{ title, price }",
       "{ price, title }"
      ]
     },
     {
      "n": 4,
      "accept": [
       "price"
      ]
     }
    ],
    "hint": "Unpack the props in the round brackets, the same way as B1: with curly brackets."
   },
   {
    "id": "b3",
    "section": "s2",
    "type": "blanks",
    "title": "useState",
    "prompt": "A like button that starts at 0 and goes up by 1 on every click.\n\n> **Tip:** `useState` gives back two things: the value, and a function that changes it. By habit, the function’s name is `set` + the value’s name, like `count` and `setCount`.",
    "code": "import { __5__ } from \"react\";\n\nfunction LikeButton() {\n  const [likes, __6__] = useState(__7__);\n  return <button onClick={() => setLikes(__8__)}>❤️ {likes}</button>;\n}",
    "lang": "js",
    "anyOrder": false,
    "blanks": [
     {
      "n": 5,
      "accept": [
       "useState"
      ]
     },
     {
      "n": 6,
      "accept": [
       "setLikes"
      ]
     },
     {
      "n": 7,
      "accept": [
       "0"
      ]
     },
     {
      "n": 8,
      "accept": [
       "likes + 1",
       "1 + likes"
      ]
     }
    ],
    "hint": "Look at the names the code already uses further down: setLikes and likes."
   },
   {
    "id": "b4",
    "section": "s2",
    "type": "blanks",
    "title": "fetch",
    "prompt": "Log the array of products from the API. The reply looks like `{ products: [...], total: 194 }`.",
    "code": "fetch(\"https://dummyjson.com/products\")\n  .then((response) => response.__9__())\n  .then((data) => console.log(data.__10__));",
    "lang": "js",
    "anyOrder": false,
    "blanks": [
     {
      "n": 9,
      "accept": [
       "json"
      ]
     },
     {
      "n": 10,
      "accept": [
       "products"
      ]
     }
    ],
    "hint": "Blank 9 reads the reply into an object. Blank 10 is a property name from the shape above."
   },
   {
    "id": "b5",
    "section": "s2",
    "type": "blanks",
    "title": "useEffect",
    "prompt": "Load one quote when the component first appears, and show it on the page.",
    "code": "import { useState, __11__ } from \"react\";\n\nfunction Quote() {\n  const [quote, setQuote] = useState(\"Loading…\");\n\n  useEffect(() => {\n    fetch(\"https://dummyjson.com/quotes/1\")\n      .then((res) => res.json())\n      .then((data) => setQuote(data.quote));\n  }, []);\n\n  return <p>{__12__}</p>;\n}",
    "lang": "js",
    "anyOrder": false,
    "blanks": [
     {
      "n": 11,
      "accept": [
       "useEffect"
      ]
     },
     {
      "n": 12,
      "accept": [
       "quote"
      ]
     }
    ],
    "hint": "Blank 11 is the hook used further down. Blank 12 is the state variable that holds the quote."
   },
   {
    "id": "b6",
    "section": "s2",
    "type": "blanks",
    "title": "Lists",
    "prompt": "Show one `ProductItem` per product, with no warning in the console.",
    "code": "<ul>\n  {products.__13__((p) => (\n    <ProductItem __14__={p.id} title={p.title} price={p.price} />\n  ))}\n</ul>",
    "lang": "js",
    "anyOrder": false,
    "blanks": [
     {
      "n": 13,
      "accept": [
       "map"
      ]
     },
     {
      "n": 14,
      "accept": [
       "key"
      ]
     }
    ],
    "hint": "Which array method turns each item into something new? And which special prop does every item in a list need?"
   },
   {
    "id": "c1",
    "section": "s3",
    "type": "code",
    "title": "Cheap titles",
    "prompt": "Write `cheapTitles(products, maxPrice)`. It returns a **new array** with the `title` of every product whose `price` is less than or equal to `maxPrice`. Use **destructuring** in your loop.",
    "lang": "js",
    "starter": "const products = [\n  { id: 1, title: \"Notebook\", price: 40 },\n  { id: 2, title: \"Backpack\", price: 900 },\n  { id: 3, title: \"Pen\", price: 10 },\n];\n\nfunction cheapTitles(products, maxPrice) {\n  // Return a NEW array of titles whose price is <= maxPrice.\n  // Use destructuring in your loop.\n}\n\nconsole.log(cheapTitles(products, 50));   // [\"Notebook\", \"Pen\"]\nconsole.log(cheapTitles(products, 5));    // []\n",
    "solution": "const products = [\n  { id: 1, title: \"Notebook\", price: 40 },\n  { id: 2, title: \"Backpack\", price: 900 },\n  { id: 3, title: \"Pen\", price: 10 },\n];\n\nfunction cheapTitles(products, maxPrice) {\n  const titles = [];\n  for (const { title, price } of products) {\n    if (price <= maxPrice) titles.push(title);\n  }\n  return titles;\n}\n\nconsole.log(cheapTitles(products, 50));   // [\"Notebook\", \"Pen\"]\nconsole.log(cheapTitles(products, 5));    // []\n",
    "setup": "const products = [\n  { id: 1, title: \"Notebook\", price: 40 },\n  { id: 2, title: \"Backpack\", price: 900 },\n  { id: 3, title: \"Pen\", price: 10 },\n];",
    "preview": "",
    "tests": [
     {
      "name": "cheapTitles(products, 50) → [\"Notebook\", \"Pen\"]",
      "expr": "cheapTitles(products, 50)",
      "op": "equals",
      "expected": "[\"Notebook\", \"Pen\"]",
      "msg": ""
     },
     {
      "name": "cheapTitles(products, 5) → []",
      "expr": "cheapTitles(products, 5)",
      "op": "equals",
      "expected": "[]",
      "msg": ""
     },
     {
      "name": "A price exactly equal to maxPrice counts",
      "expr": "cheapTitles(products, 40)",
      "op": "equals",
      "expected": "[\"Notebook\", \"Pen\"]",
      "msg": "cheapTitles(products, 40) gave {got}. A price of exactly 40 should count: use <=."
     },
     {
      "name": "Works on a different list",
      "expr": "cheapTitles([{ id: 9, title: \"Chai\", price: 15 }, { id: 8, title: \"Laptop\", price: 50000 }], 100)",
      "op": "equals",
      "expected": "[\"Chai\"]",
      "msg": ""
     },
     {
      "name": "The products array is not changed",
      "expr": "(() => { const before = JSON.stringify(products); cheapTitles(products, 50); return JSON.stringify(products) === before; })()",
      "op": "truthy",
      "expected": "",
      "msg": "The function changed the products array. Build a new array instead."
     },
     {
      "name": "Uses destructuring: { title, price }",
      "expr": "",
      "op": "source",
      "expected": "\\b(const|let|var)\\s*\\{[^{}]*\\b(title|price)\\b[^{}]*\\}\\s*(=|of\\b)|\\(\\s*\\{[^{}]*\\b(title|price)\\b[^{}]*\\}\\s*\\)\\s*=>",
      "msg": "Unpack the product with destructuring, for example: for (const { title, price } of products)"
     }
    ],
    "hint": "for (const { title, price } of products) { ... } then push the title when the price is small enough."
   },
   {
    "id": "c2",
    "section": "s3",
    "type": "code",
    "title": "A profile card",
    "prompt": "Write a `ProfileCard` component that shows a **photo**, a **name** and a **role**. It gets them as props and reads them with **destructuring**. Then use it **twice** in `App`, with two different people.\n\nFor photos you can use links like `https://i.pravatar.cc/100?img=5`.",
    "lang": "react",
    "starter": "function ProfileCard(/* get name, role and photo here */) {\n  return (\n    <div className=\"card\">\n      {/* the photo, the name and the role */}\n    </div>\n  );\n}\n\nfunction App() {\n  return (\n    <div>\n      {/* use ProfileCard twice, with two different people */}\n    </div>\n  );\n}\n",
    "solution": "function ProfileCard({ name, role, photo }) {\n  return (\n    <div className=\"card\">\n      <img src={photo} alt={name} />\n      <h3>{name}</h3>\n      <p>{role}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return (\n    <div>\n      <ProfileCard name=\"Priya Rao\" role=\"Frontend developer\" photo=\"https://i.pravatar.cc/100?img=5\" />\n      <ProfileCard name=\"Arjun Nair\" role=\"Designer\" photo=\"https://i.pravatar.cc/100?img=12\" />\n    </div>\n  );\n}\n",
    "setup": "",
    "preview": "App",
    "tests": [
     {
      "name": "ProfileCard shows the name and the role",
      "expr": "(await render(ProfileCard, { name: \"Ada Lovelace\", role: \"Engineer\", photo: \"ada.png\" })).text",
      "op": "matches",
      "expected": "^(?=.*Ada Lovelace)(?=.*Engineer)",
      "msg": "It should show the name and the role it gets as props. It shows: {got}"
     },
     {
      "name": "It shows the photo with <img src={photo}>",
      "expr": "(await render(ProfileCard, { name: \"Ada\", role: \"Engineer\", photo: \"ada.png\" })).attr(\"img\", \"src\")",
      "op": "equals",
      "expected": "\"ada.png\"",
      "msg": "The <img> src is {got}. Use src={photo}."
     },
     {
      "name": "Props are read with destructuring",
      "expr": "",
      "op": "source",
      "expected": "function\\s+ProfileCard\\s*\\(\\s*\\{[^}]*\\}\\s*\\)|ProfileCard\\s*=\\s*\\(\\s*\\{[^}]*\\}\\s*\\)\\s*=>|const\\s*\\{[^}]*\\}\\s*=\\s*props",
      "msg": "Write function ProfileCard({ name, role, photo })."
     },
     {
      "name": "App shows two cards with photos",
      "expr": "(await render(App)).count(\"img\")",
      "op": "equals",
      "expected": "2",
      "msg": "App shows {got} photo(s). Use ProfileCard twice."
     },
     {
      "name": "The two cards show different people",
      "expr": "(r => new Set(r.attrs(\"img\", \"src\")).size >= 2 || new Set(r.attrs(\"img\", \"alt\")).size >= 2)(await render(App))",
      "op": "truthy",
      "expected": "",
      "msg": "The two cards look the same. Give them different people."
     }
    ],
    "hint": "function ProfileCard({ name, role, photo }) and, inside, <img src={photo} alt={name} />."
   },
   {
    "id": "c3",
    "section": "s3",
    "type": "code",
    "title": "Run the app from the terminal",
    "prompt": "You’ve just opened the terminal, and you are in the **Desktop** folder. Your React app (made with Vite) is in `Desktop/frontend/canteen-react`. Its packages aren’t installed yet.\n\nWrite the commands, **one per line**, to:\n\n1. go into the app’s folder\n2. install the packages\n3. start the app\n\nPress **Run** to play your commands in a pretend terminal.",
    "lang": "terminal",
    "starter": "# You are in: Desktop\n# Write one command per line.\n\n",
    "solution": "# You are in: Desktop\ncd frontend/canteen-react\nnpm install\nnpm run dev\n",
    "setup": "",
    "preview": "",
    "tests": [],
    "hint": "cd + a folder name goes into that folder. npm has one command that downloads the packages, and Vite apps start with npm run …",
    "terminal": {
     "tree": {
      "Desktop": {
       "frontend": {
        "canteen-react": {
         "package.json": 1,
         "index.html": 1,
         "src": {},
         "public": {}
        },
        "react-basics": {}
       },
       "notes.txt": 1
      },
      "Documents": {},
      "Downloads": {}
     },
     "start": "Desktop",
     "app": "Desktop/frontend/canteen-react",
     "script": "dev"
    }
   },
   {
    "id": "c4",
    "section": "s3",
    "type": "code",
    "title": "A user list",
    "prompt": "Write a `UserList` that loads `https://dummyjson.com/users` **once**, when it first appears.\n\n- While there are no users yet, show `Loading…`.\n- Then show one `<li>` per user: first name, last name and email.\n- Use `key` correctly.",
    "lang": "react",
    "starter": "import { useState, useEffect } from \"react\";\n\nfunction UserList() {\n  // 1. state for the users\n  // 2. useEffect: fetch \"https://dummyjson.com/users\" once\n  //    (the reply looks like { users: [ { id, firstName, lastName, email } ] })\n  // 3. \"Loading…\" while there are no users yet, then one <li> per user\n\n  return <p>Loading…</p>;\n}\n",
    "solution": "import { useState, useEffect } from \"react\";\n\nfunction UserList() {\n  const [users, setUsers] = useState([]);\n\n  useEffect(() => {\n    fetch(\"https://dummyjson.com/users\")\n      .then((res) => res.json())\n      .then((data) => setUsers(data.users));\n  }, []);\n\n  if (users.length === 0) return <p>Loading…</p>;\n\n  return (\n    <ul>\n      {users.map((u) => (\n        <li key={u.id}>{u.firstName} {u.lastName} · {u.email}</li>\n      ))}\n    </ul>\n  );\n}\n",
    "setup": "const USERS = { users: [\n  { id: 1, firstName: \"Grace\", lastName: \"Hopper\", email: \"grace@test.dev\" },\n  { id: 2, firstName: \"Alan\", lastName: \"Turing\", email: \"alan@test.dev\" },\n  { id: 3, firstName: \"Katherine\", lastName: \"Johnson\", email: \"katherine@test.dev\" }], total: 3, skip: 0, limit: 30 };",
    "preview": "UserList",
    "tests": [
     {
      "name": "Shows Loading… before the users arrive",
      "expr": "(await render(UserList, {}, { reply: USERS, wait: 0 })).text",
      "op": "matches",
      "expected": "[Ll]oading",
      "msg": "Before the data arrives it shows: {got}"
     },
     {
      "name": "Fetches https://dummyjson.com/users once",
      "expr": "(await render(UserList, {}, { reply: USERS })).fetchCalls",
      "op": "equals",
      "expected": "[\"https://dummyjson.com/users\"]",
      "msg": "fetch was called with: {got}. Call it once, in useEffect with [] at the end."
     },
     {
      "name": "Shows one <li> per user",
      "expr": "(await render(UserList, {}, { reply: USERS })).count(\"li\")",
      "op": "equals",
      "expected": "3",
      "msg": "There are {got} <li> (the check sends 3 users)."
     },
     {
      "name": "Each line has the first name, last name and email",
      "expr": "(await render(UserList, {}, { reply: USERS })).text",
      "op": "matches",
      "expected": "^(?=.*Grace)(?=.*Hopper)(?=.*grace@test\\.dev)(?!.*[Ll]oading)",
      "msg": "After the users arrive it shows: {got}"
     },
     {
      "name": "Uses key in the list",
      "expr": "",
      "op": "source",
      "expected": "key\\s*=\\s*\\{",
      "msg": "Add key={user.id} to each <li>."
     }
    ],
    "hint": "useState([]) for the users. In useEffect(..., []): fetch, .json(), then setUsers(data.users). If users.length === 0, return <p>Loading…</p>."
   },
   {
    "id": "d1",
    "section": "s4",
    "type": "code",
    "title": "The ₹0602030 bill",
    "prompt": "The till adds up an order, but a ₹110 order comes out as `\"0602030\"`. Run it, read the console, and fix the **one line** that is wrong.",
    "lang": "js",
    "starter": "// The canteen's till adds up an order.\n// A ₹110 order came out as \"0602030\". Only ONE line is wrong. Fix it.\n\nconst order = [\n  { dish: \"Masala dosa\", price: \"60\" },\n  { dish: \"Filter coffee\", price: \"20\" },\n  { dish: \"Vada\", price: \"30\" },\n];\n\nfunction billTotal(order) {\n  let total = 0;\n  for (const { price } of order) {\n    total = total + price;\n  }\n  return total;\n}\n\nfunction printBill(order) {\n  for (const { dish, price } of order) {\n    console.log(`${dish} ........ ₹${price}`);\n  }\n  console.log(`TOTAL ........ ₹${billTotal(order)}`);\n}\n\nprintBill(order);   // TOTAL should be ₹110\n",
    "solution": "// The canteen's till adds up an order.\n// A ₹110 order came out as \"0602030\". Only ONE line is wrong. Fix it.\n\nconst order = [\n  { dish: \"Masala dosa\", price: \"60\" },\n  { dish: \"Filter coffee\", price: \"20\" },\n  { dish: \"Vada\", price: \"30\" },\n];\n\nfunction billTotal(order) {\n  let total = 0;\n  for (const { price } of order) {\n    total = total + Number(price);\n  }\n  return total;\n}\n\nfunction printBill(order) {\n  for (const { dish, price } of order) {\n    console.log(`${dish} ........ ₹${price}`);\n  }\n  console.log(`TOTAL ........ ₹${billTotal(order)}`);\n}\n\nprintBill(order);   // TOTAL should be ₹110\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "billTotal(order) is the number 110",
      "expr": "billTotal([{ dish: \"a\", price: \"60\" }, { dish: \"b\", price: \"20\" }, { dish: \"c\", price: \"30\" }])",
      "op": "equals",
      "expected": "110",
      "msg": ""
     },
     {
      "name": "Works on another order",
      "expr": "billTotal([{ price: \"45\" }, { price: \"5\" }])",
      "op": "equals",
      "expected": "50",
      "msg": "billTotal of \"45\" and \"5\" gave {got}"
     },
     {
      "name": "An empty order is 0",
      "expr": "billTotal([])",
      "op": "equals",
      "expected": "0",
      "msg": ""
     }
    ],
    "hint": "The prices in the order are text. What does \"0\" + \"60\" give? Number() turns text into a number."
   },
   {
    "id": "d2",
    "section": "s4",
    "type": "code",
    "title": "The missing topper",
    "prompt": "It should say `Meera topped Block C with 95`, but it always says no one is in Block C. Fix the **one line** that is wrong.",
    "lang": "js",
    "starter": "// Finds the topper of one block.\n// It always says \"No students in Block C\". Only ONE line is wrong. Fix it.\n\nconst students = [\n  { name: \"Ananya\", block: \"A\", marks: 91 },\n  { name: \"Rohan\", block: \"C\", marks: 88 },\n  { name: \"Meera\", block: \"C\", marks: 95 },\n  { name: \"Karthik\", block: \"B\", marks: 99 },\n];\n\nfunction topper(students, block) {\n  let best = null;\n  for (const s in students) {\n    if (s.block === block) {\n      if (best === null || s.marks > best.marks) {\n        best = s;\n      }\n    }\n  }\n  if (best === null) {\n    return `No students in Block ${block}`;\n  }\n  return `${best.name} topped Block ${block} with ${best.marks}`;\n}\n\nconsole.log(topper(students, \"C\"));   // Meera topped Block C with 95\nconsole.log(topper(students, \"Z\"));   // No students in Block Z\n",
    "solution": "// Finds the topper of one block.\n// It always says \"No students in Block C\". Only ONE line is wrong. Fix it.\n\nconst students = [\n  { name: \"Ananya\", block: \"A\", marks: 91 },\n  { name: \"Rohan\", block: \"C\", marks: 88 },\n  { name: \"Meera\", block: \"C\", marks: 95 },\n  { name: \"Karthik\", block: \"B\", marks: 99 },\n];\n\nfunction topper(students, block) {\n  let best = null;\n  for (const s of students) {\n    if (s.block === block) {\n      if (best === null || s.marks > best.marks) {\n        best = s;\n      }\n    }\n  }\n  if (best === null) {\n    return `No students in Block ${block}`;\n  }\n  return `${best.name} topped Block ${block} with ${best.marks}`;\n}\n\nconsole.log(topper(students, \"C\"));   // Meera topped Block C with 95\nconsole.log(topper(students, \"Z\"));   // No students in Block Z\n",
    "setup": "const STUDENTS = () => [\n  { name: \"Ananya\", block: \"A\", marks: 91 },\n  { name: \"Rohan\", block: \"C\", marks: 88 },\n  { name: \"Meera\", block: \"C\", marks: 95 },\n  { name: \"Karthik\", block: \"B\", marks: 99 },\n];",
    "preview": "",
    "tests": [
     {
      "name": "Block C → Meera topped Block C with 95",
      "expr": "topper(STUDENTS(), \"C\")",
      "op": "equals",
      "expected": "\"Meera topped Block C with 95\"",
      "msg": ""
     },
     {
      "name": "Block B → Karthik",
      "expr": "topper(STUDENTS(), \"B\")",
      "op": "equals",
      "expected": "\"Karthik topped Block B with 99\"",
      "msg": ""
     },
     {
      "name": "Block Z → No students in Block Z",
      "expr": "topper(STUDENTS(), \"Z\")",
      "op": "equals",
      "expected": "\"No students in Block Z\"",
      "msg": ""
     }
    ],
    "hint": "Add console.log(s) inside the loop. Is s a student, or something else? Two loops look alike: for…in and for…of."
   },
   {
    "id": "d3",
    "section": "s4",
    "type": "code",
    "title": "The vanishing stock",
    "prompt": "The board says `0 left` for every dish, and the stock numbers disappear. Fix the **one line** that is wrong.",
    "lang": "js",
    "starter": "// The menu board shows \"Sold out\", or how many are left.\n// It says \"0 left\" for every dish, and the stock numbers vanish.\n// Only ONE line is wrong. Fix it.\n\nconst menu = [\n  { dish: \"Masala dosa\", stock: 12 },\n  { dish: \"Vada\", stock: 0 },\n  { dish: \"Lemon rice\", stock: 3 },\n];\n\nfunction stockLabel(item) {\n  if (item.stock = 0) {\n    return \"Sold out\";\n  }\n  return `${item.stock} left`;\n}\n\nfor (const item of menu) {\n  console.log(item.dish, \"-\", stockLabel(item));\n}\n",
    "solution": "// The menu board shows \"Sold out\", or how many are left.\n// It says \"0 left\" for every dish, and the stock numbers vanish.\n// Only ONE line is wrong. Fix it.\n\nconst menu = [\n  { dish: \"Masala dosa\", stock: 12 },\n  { dish: \"Vada\", stock: 0 },\n  { dish: \"Lemon rice\", stock: 3 },\n];\n\nfunction stockLabel(item) {\n  if (item.stock === 0) {\n    return \"Sold out\";\n  }\n  return `${item.stock} left`;\n}\n\nfor (const item of menu) {\n  console.log(item.dish, \"-\", stockLabel(item));\n}\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "stock 0 → \"Sold out\"",
      "expr": "stockLabel({ dish: \"Vada\", stock: 0 })",
      "op": "equals",
      "expected": "\"Sold out\"",
      "msg": ""
     },
     {
      "name": "stock 12 → \"12 left\"",
      "expr": "stockLabel({ dish: \"Dosa\", stock: 12 })",
      "op": "equals",
      "expected": "\"12 left\"",
      "msg": ""
     },
     {
      "name": "The stock number is not changed",
      "expr": "(() => { const item = { dish: \"Dosa\", stock: 7 }; stockLabel(item); return item.stock; })()",
      "op": "equals",
      "expected": "7",
      "msg": "After the call, stock became {got}."
     }
    ],
    "hint": "Look closely at the if. One = gives a value. Three === compare."
   },
   {
    "id": "d4",
    "section": "s4",
    "type": "code",
    "title": "The empty menu",
    "prompt": "The menu should show one `<li>` per dish, but the list is empty. There’s no error at all. Fix the **one line** that is wrong.",
    "lang": "react",
    "starter": "// The menu should show one <li> per dish.\n// The list is empty, and there is no error. Only ONE line is wrong. Fix it.\n\nconst dishes = [\"Masala dosa\", \"Idli\", \"Vada\", \"Lemon rice\"];\n\nfunction Menu() {\n  return (\n    <div>\n      <h2>Menu ({dishes.length} dishes)</h2>\n      <ul>\n        {dishes.map((dish) => { <li key={dish}>{dish}</li> })}\n      </ul>\n    </div>\n  );\n}\n",
    "solution": "// The menu should show one <li> per dish.\n// The list is empty, and there is no error. Only ONE line is wrong. Fix it.\n\nconst dishes = [\"Masala dosa\", \"Idli\", \"Vada\", \"Lemon rice\"];\n\nfunction Menu() {\n  return (\n    <div>\n      <h2>Menu ({dishes.length} dishes)</h2>\n      <ul>\n        {dishes.map((dish) => <li key={dish}>{dish}</li>)}\n      </ul>\n    </div>\n  );\n}\n",
    "setup": "",
    "preview": "Menu",
    "tests": [
     {
      "name": "It shows 4 <li>",
      "expr": "(await render(Menu)).count(\"li\")",
      "op": "equals",
      "expected": "4",
      "msg": "There are {got} <li> on the page."
     },
     {
      "name": "Each <li> shows the dish’s name",
      "expr": "(await render(Menu)).texts(\"li\")",
      "op": "equals",
      "expected": "[\"Masala dosa\", \"Idli\", \"Vada\", \"Lemon rice\"]",
      "msg": "The <li> say: {got}"
     }
    ],
    "hint": "Look at B6: which brackets come right after the => there? With { } you have to write return. With ( ) the arrow gives the value back by itself."
   },
   {
    "id": "d5",
    "section": "s4",
    "type": "code",
    "title": "The list that crashes",
    "prompt": "The page goes blank with `products.map is not a function`. The reply looks like `{ products: [...], total: 194 }`. Fix the **one line** that is wrong.",
    "lang": "react",
    "starter": "import { useState, useEffect } from \"react\";\n\n// Shows products from the API. The page goes blank, and the console says:\n//   \"products.map is not a function\"\n// The reply looks like: { products: [ ... ], total: 194 }\n// Only ONE line is wrong. Fix it.\n\nfunction ProductList() {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch(\"https://dummyjson.com/products\")\n      .then((res) => res.json())\n      .then((data) => setProducts(data));\n  }, []);\n\n  return (\n    <div>\n      <h2>Products ({products.length})</h2>\n      <ul>\n        {products.map((p) => (\n          <li key={p.id}>\n            {p.title} · ${p.price}\n          </li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n",
    "solution": "import { useState, useEffect } from \"react\";\n\n// Shows products from the API. The page goes blank, and the console says:\n//   \"products.map is not a function\"\n// The reply looks like: { products: [ ... ], total: 194 }\n// Only ONE line is wrong. Fix it.\n\nfunction ProductList() {\n  const [products, setProducts] = useState([]);\n\n  useEffect(() => {\n    fetch(\"https://dummyjson.com/products\")\n      .then((res) => res.json())\n      .then((data) => setProducts(data.products));\n  }, []);\n\n  return (\n    <div>\n      <h2>Products ({products.length})</h2>\n      <ul>\n        {products.map((p) => (\n          <li key={p.id}>\n            {p.title} · ${p.price}\n          </li>\n        ))}\n      </ul>\n    </div>\n  );\n}\n",
    "setup": "const PRODUCTS = { products: [{ id: 1, title: \"Test Lamp\", price: 12 }, { id: 2, title: \"Test Mug\", price: 5 }, { id: 3, title: \"Test Pen\", price: 2 }], total: 3, skip: 0, limit: 30 };",
    "preview": "ProductList",
    "tests": [
     {
      "name": "It doesn’t crash",
      "expr": "!!(await render(ProductList, {}, { reply: PRODUCTS }))",
      "op": "truthy",
      "expected": "",
      "msg": ""
     },
     {
      "name": "It shows one <li> per product",
      "expr": "(await render(ProductList, {}, { reply: PRODUCTS })).count(\"li\")",
      "op": "equals",
      "expected": "3",
      "msg": "There are {got} <li> (the check sends 3 products)."
     },
     {
      "name": "The heading shows the count, and the titles show",
      "expr": "(await render(ProductList, {}, { reply: PRODUCTS })).text",
      "op": "matches",
      "expected": "^(?=.*Products \\(3\\))(?=.*Test Lamp)",
      "msg": "It shows: {got}"
     }
    ],
    "hint": "data is the whole reply: an object, not an array. The array is inside it."
   },
   {
    "id": "d6",
    "section": "s4",
    "type": "code",
    "title": "The blank titles",
    "prompt": "The price and the stock show, but every title is blank. There’s no error at all. Fix the **one line** that is wrong.",
    "lang": "react",
    "starter": "// ProductCard should show the title, the price and the stock.\n// The price and stock show, but every title is blank.\n// Only ONE line is wrong. Fix it.\n\nfunction ProductCard({ title, price, inStock }) {\n  return (\n    <div className=\"card\">\n      <h3>{name}</h3>\n      <p>₹{price}</p>\n      <p>{inStock ? \"In stock\" : \"Out of stock\"}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return (\n    <div>\n      <ProductCard title=\"Notebook\" price={40} inStock={true} />\n      <ProductCard title=\"Backpack\" price={900} inStock={false} />\n    </div>\n  );\n}\n",
    "solution": "// ProductCard should show the title, the price and the stock.\n// The price and stock show, but every title is blank.\n// Only ONE line is wrong. Fix it.\n\nfunction ProductCard({ title, price, inStock }) {\n  return (\n    <div className=\"card\">\n      <h3>{title}</h3>\n      <p>₹{price}</p>\n      <p>{inStock ? \"In stock\" : \"Out of stock\"}</p>\n    </div>\n  );\n}\n\nfunction App() {\n  return (\n    <div>\n      <ProductCard title=\"Notebook\" price={40} inStock={true} />\n      <ProductCard title=\"Backpack\" price={900} inStock={false} />\n    </div>\n  );\n}\n",
    "setup": "",
    "preview": "App",
    "tests": [
     {
      "name": "ProductCard shows the title",
      "expr": "(await render(ProductCard, { title: \"Notebook\", price: 40, inStock: true })).texts(\"h3\")",
      "op": "equals",
      "expected": "[\"Notebook\"]",
      "msg": "The <h3> says {got}"
     },
     {
      "name": "App shows both cards with their titles",
      "expr": "(await render(App)).text",
      "op": "matches",
      "expected": "^(?=.*Notebook)(?=.*Backpack)",
      "msg": "It shows: {got}"
     }
    ],
    "hint": "Which names come out of the props in the round brackets? Is the one in the h3 one of them?"
   },
   {
    "id": "d7",
    "section": "s4",
    "type": "code",
    "title": "Boss bug hunt: the order summary",
    "prompt": "The boss level: this one has **3 bugs**. When it works, `summary(order)` gives back `Kavya ordered 3 items. Total: ₹110`. Fix one bug, run again, and the next one shows itself.",
    "lang": "js",
    "starter": "// BOSS BUG HUNT: this one has 3 bugs, not 1.\n// summary(order) should give back: \"Kavya ordered 3 items. Total: ₹110\"\n// Fix them all.\n\nconst order = {\n  customer: \"Kavya\",\n  items: [\n    { dish: \"Masala dosa\", price: 60 },\n    { dish: \"Filter coffee\", price: 20 },\n    { dish: \"Vada\", price: 30 },\n  ],\n};\n\nfunction summary(order) {\n  const { customer, item } = order;\n  let total = 0;\n  for (const { price } of items) {\n    total = price;\n  }\n  return `${customer} ordered ${items.lenght} items. Total: ₹${total}`;\n}\n\nconsole.log(summary(order));   // Kavya ordered 3 items. Total: ₹110\n",
    "solution": "// BOSS BUG HUNT: this one has 3 bugs, not 1.\n// summary(order) should give back: \"Kavya ordered 3 items. Total: ₹110\"\n// Fix them all.\n\nconst order = {\n  customer: \"Kavya\",\n  items: [\n    { dish: \"Masala dosa\", price: 60 },\n    { dish: \"Filter coffee\", price: 20 },\n    { dish: \"Vada\", price: 30 },\n  ],\n};\n\nfunction summary(order) {\n  const { customer, items } = order;\n  let total = 0;\n  for (const { price } of items) {\n    total = total + price;\n  }\n  return `${customer} ordered ${items.length} items. Total: ₹${total}`;\n}\n\nconsole.log(summary(order));   // Kavya ordered 3 items. Total: ₹110\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "summary(order) → \"Kavya ordered 3 items. Total: ₹110\"",
      "expr": "summary({ customer: \"Kavya\", items: [{ dish: \"Masala dosa\", price: 60 }, { dish: \"Filter coffee\", price: 20 }, { dish: \"Vada\", price: 30 }] })",
      "op": "equals",
      "expected": "\"Kavya ordered 3 items. Total: ₹110\"",
      "msg": ""
     },
     {
      "name": "Works on another order (Arjun, 2 items, ₹75)",
      "expr": "summary({ customer: \"Arjun\", items: [{ dish: \"Idli\", price: 45 }, { dish: \"Chai\", price: 30 }] })",
      "op": "equals",
      "expected": "\"Arjun ordered 2 items. Total: ₹75\"",
      "msg": ""
     },
     {
      "name": "An empty order → \"… ordered 0 items. Total: ₹0\"",
      "expr": "summary({ customer: \"Meera\", items: [] })",
      "op": "equals",
      "expected": "\"Meera ordered 0 items. Total: ₹0\"",
      "msg": ""
     }
    ],
    "hint": "The 3 bugs: a property name that doesn’t match the object, a spelling mistake, and a total that forgets what it already had."
   }
  ]
 },
 {
  "title": "Python basics (sample)",
  "description": "A short sample showing Python questions: lists, input(), loops and debugging.",
  "minutes": 30,
  "points": 1,
  "hintPenalty": 0.5,
  "sections": [
   {
    "id": "s1",
    "title": "Multiple choice"
   },
   {
    "id": "s2",
    "title": "Fill in the blanks"
   },
   {
    "id": "s3",
    "title": "Write the code"
   },
   {
    "id": "s4",
    "title": "Debugging"
   }
  ],
  "questions": [
   {
    "id": "pa1",
    "section": "s1",
    "type": "mcq",
    "title": "Length of a list",
    "prompt": "What does this print?",
    "code": "print(len([3, 1, 4]))",
    "codeLang": "python",
    "options": [
     "`3`",
     "`4`",
     "`[3, 1, 4]`",
     "An error"
    ],
    "answer": 0,
    "hint": "len() counts the items."
   },
   {
    "id": "pa2",
    "section": "s1",
    "type": "mcq",
    "title": "Adding text",
    "prompt": "What is `x` after this line?",
    "code": "x = \"5\" + \"5\"",
    "codeLang": "python",
    "options": [
     "`10`",
     "`\"55\"`",
     "`\"10\"`",
     "An error"
    ],
    "answer": 1,
    "hint": "Both are text, in quotes. + joins text."
   },
   {
    "id": "pa3",
    "section": "s1",
    "type": "mcq",
    "title": "range",
    "prompt": "Which numbers does this loop print?",
    "code": "for i in range(1, 4):\n    print(i)",
    "codeLang": "python",
    "options": [
     "0, 1, 2, 3",
     "1, 2, 3",
     "1, 2, 3, 4",
     "0, 1, 2, 3, 4"
    ],
    "answer": 1,
    "hint": "range(start, stop) stops just before stop."
   },
   {
    "id": "pb1",
    "section": "s2",
    "type": "blanks",
    "title": "Average",
    "prompt": "Fill in the blanks so `average([2, 4, 6])` gives back `4.0`.",
    "code": "def average(nums):\n    return __1__(nums) / __2__(nums)",
    "lang": "python",
    "anyOrder": false,
    "blanks": [
     {
      "n": 1,
      "accept": [
       "sum"
      ]
     },
     {
      "n": 2,
      "accept": [
       "len"
      ]
     }
    ],
    "hint": "One built-in adds up a list. Another counts its items."
   },
   {
    "id": "pb2",
    "section": "s2",
    "type": "blanks",
    "title": "Names that start with A",
    "prompt": "Print only the names that start with `A`.",
    "code": "names = [\"Asha\", \"Ravi\", \"Anil\"]\n\nfor name in __1__:\n    if name.__2__(\"A\"):\n        print(name)",
    "lang": "python",
    "anyOrder": false,
    "blanks": [
     {
      "n": 1,
      "accept": [
       "names"
      ]
     },
     {
      "n": 2,
      "accept": [
       "startswith"
      ]
     }
    ],
    "hint": "Loop over the list. Text has a method that checks how it begins."
   },
   {
    "id": "pc1",
    "section": "s3",
    "type": "code",
    "title": "Even numbers",
    "prompt": "Write `even_numbers(nums)`. It gives back a **new list** with only the even numbers from `nums`, in the same order.",
    "lang": "python",
    "starter": "def even_numbers(nums):\n    # give back a new list with only the even numbers\n    pass\n\n\nprint(even_numbers([1, 2, 3, 4]))   # [2, 4]\n",
    "solution": "def even_numbers(nums):\n    return [n for n in nums if n % 2 == 0]\n\n\nprint(even_numbers([1, 2, 3, 4]))   # [2, 4]\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "even_numbers([1, 2, 3, 4]) → [2, 4]",
      "expr": "even_numbers([1, 2, 3, 4])",
      "op": "equals",
      "expected": "[2, 4]",
      "msg": ""
     },
     {
      "name": "even_numbers([]) → []",
      "expr": "even_numbers([])",
      "op": "equals",
      "expected": "[]",
      "msg": ""
     },
     {
      "name": "No even numbers → []",
      "expr": "even_numbers([7, 9, 11])",
      "op": "equals",
      "expected": "[]",
      "msg": ""
     },
     {
      "name": "Negative and zero count too",
      "expr": "even_numbers([-2, 0, 5])",
      "op": "equals",
      "expected": "[-2, 0]",
      "msg": ""
     },
     {
      "name": "The list passed in is not changed",
      "expr": "(lambda l: (even_numbers(l), l)[1])([1, 2, 3])",
      "op": "equals",
      "expected": "[1, 2, 3]",
      "msg": "The function changed the list it was given. Build a new list instead."
     }
    ],
    "hint": "A number is even when n % 2 == 0. Make an empty list, loop, and append the even ones."
   },
   {
    "id": "pc2",
    "section": "s3",
    "type": "code",
    "title": "Add two numbers",
    "prompt": "Read **two numbers** with `input()`, then print their sum like this:\n\n```text\nSum: 7\n```\n\nType test input in the **Input** box under the editor, one number per line.",
    "lang": "python",
    "starter": "# Read two numbers, then print:  Sum: 7\na = input(\"First number: \")\n",
    "solution": "a = int(input(\"First number: \"))\nb = int(input(\"Second number: \"))\nprint(\"Sum:\", a + b)\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "3 and 4 → Sum: 7",
      "expr": "OUTPUT",
      "op": "includes",
      "expected": "Sum: 7",
      "msg": "With 3 and 4 it printed: {got}"
     },
     {
      "name": "10 and -2 → Sum: 8",
      "expr": "run(\"10\\n-2\")",
      "op": "includes",
      "expected": "Sum: 8",
      "msg": "With 10 and -2 it printed: {got}"
     },
     {
      "name": "Turns the text into numbers",
      "expr": "",
      "op": "source",
      "expected": "\\b(int|float)\\s*\\(",
      "msg": "input() gives back text. Turn it into a number with int()."
     }
    ],
    "hint": "input() gives text. int(input()) gives a number. Then print(\"Sum:\", a + b).",
    "stdin": "3\n4"
   },
   {
    "id": "pd1",
    "section": "s4",
    "type": "code",
    "title": "Counting vowels",
    "prompt": "`count_vowels(\"banana\")` should be `3`, but it’s always `0` or `1`. Fix the **one line** that is wrong.",
    "lang": "python",
    "starter": "def count_vowels(word):\n    count = 0\n    for letter in word:\n        if letter in \"aeiou\":\n            count = 1\n    return count\n\n\nprint(count_vowels(\"banana\"))   # 3\n",
    "solution": "def count_vowels(word):\n    count = 0\n    for letter in word:\n        if letter in \"aeiou\":\n            count = count + 1\n    return count\n\n\nprint(count_vowels(\"banana\"))   # 3\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "count_vowels(\"banana\") → 3",
      "expr": "count_vowels(\"banana\")",
      "op": "equals",
      "expected": "3",
      "msg": ""
     },
     {
      "name": "count_vowels(\"sky\") → 0",
      "expr": "count_vowels(\"sky\")",
      "op": "equals",
      "expected": "0",
      "msg": ""
     },
     {
      "name": "count_vowels(\"idea\") → 3",
      "expr": "count_vowels(\"idea\")",
      "op": "equals",
      "expected": "3",
      "msg": ""
     }
    ],
    "hint": "count = 1 sets it to 1 every time. It should add 1 to what it already has."
   },
   {
    "id": "pd2",
    "section": "s4",
    "type": "code",
    "title": "Next year’s age",
    "prompt": "It should print `Next year you will be 18`, but it stops with an error. Fix the **one line** that is wrong.",
    "lang": "python",
    "starter": "age = 17\nprint(\"Next year you will be \" + age + 1)\n",
    "solution": "age = 17\nprint(\"Next year you will be \" + str(age + 1))\n",
    "setup": "",
    "preview": "",
    "tests": [
     {
      "name": "It prints Next year you will be 18",
      "expr": "OUTPUT",
      "op": "includes",
      "expected": "Next year you will be 18",
      "msg": "It printed: {got}"
     }
    ],
    "hint": "You can’t + text and a number. Do the sum first, then turn it into text with str()."
   }
  ]
 }
];
