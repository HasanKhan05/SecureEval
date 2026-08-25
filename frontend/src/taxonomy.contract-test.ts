import { SCAN_CATEGORY_IDS, STRATEGY_IDS } from "./taxonomy";

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends
  (<T>() => T extends B ? 1 : 2) ? true : false;

const categoriesMatch: Equal<typeof SCAN_CATEGORY_IDS, readonly [
  "injection", "authentication_authorization", "secrets",
  "input_validation", "dependency_configuration",
]> = true;
const strategiesMatch: Equal<typeof STRATEGY_IDS, readonly [
  "vulnerability_specific_v1", "scanner_feedback_v1", "test_feedback_v1",
]> = true;
void categoriesMatch;
void strategiesMatch;