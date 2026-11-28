/**
 * Schools behind the home page "reach" map.
 *
 * Add a school by adding one line: its name and its coordinates (look them up
 * on openstreetmap.org: right-click the building → "Show address"). The map,
 * the area and the school count all update from this list. Only list schools
 * that a current member or mentor actually attends.
 */
export type ReachSchool = { name: string; lat: number; lng: number };

export type ReachView = {
  id: "ottawa" | "ontario";
  /** What the stat card says the points are, e.g. "Ottawa schools". */
  noun: string;
  /** Land area of the region, for the "% of the city/province" line. */
  regionName: string;
  regionAreaKm2: number;
  schools: ReachSchool[];
};

/** Where our students go to school (from the founders' and members' profiles). */
const STUDENT_SCHOOLS: ReachSchool[] = [
  { name: "Merivale High School", lat: 45.34327, lng: -75.72706 },
  { name: "John McCrae Secondary School", lat: 45.27848, lng: -75.76418 },
  { name: "Earl of March Secondary School", lat: 45.32313, lng: -75.8958 },
];

/** Where our mentors study (from the mentor profiles on the Team page). */
const MENTOR_SCHOOLS: ReachSchool[] = [
  { name: "Carleton University", lat: 45.38586, lng: -75.695 },
  { name: "University of Waterloo", lat: 43.4702, lng: -80.54524 },
];

export const REACH_VIEWS: ReachView[] = [
  {
    id: "ottawa",
    noun: "Ottawa schools",
    regionName: "the city's",
    regionAreaKm2: 2788, // City of Ottawa land area, 2021 Census
    schools: STUDENT_SCHOOLS,
  },
  {
    id: "ontario",
    noun: "mentor universities",
    regionName: "the province's",
    regionAreaKm2: 1_076_395, // Province of Ontario, total area
    schools: MENTOR_SCHOOLS,
  },
];
