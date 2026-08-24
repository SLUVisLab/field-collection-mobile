import { route, layout, index } from "@react-router/dev/routes";

export default [
  // Public route - no auth required
  route("login", "pages/login/Login.jsx"),
  route("register", "pages/register/Register.jsx"),
  
  // Protected routes with auth layout
  layout("layouts/AuthRequired.jsx", [
    index("pages/search/Search.jsx"),
    route("profile", "pages/profile/Profile.jsx"),
    route("home", "pages/home/Home.jsx"),
    route("guide", "pages/guide/Guide.jsx"),
  ]),
];