"use client";

import React, { useState, useEffect } from "react";
import DashboardLayout from "../../components/DashboardLayout";
import DashboardCard from "../../components/DashboardCard";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import ChatThreadsTable from "../components/ChatThreadsTable";
import AssessmentHistory from "../../components/AssessmentHistory";

interface StudentDetails {
  id: string;
  roll_number: string | null;
  email: string;
  name: string;
  grade_name: string;
  section_name: string;
  attendance_percentage?: number;
  chat_threads?: ChatThread[];
  assessments?: AssessmentData[];
  study_plans?: StudyPlanData[];
  lesson_contents?: LessonContentData[];
  lesson_plans?: LessonPlanData[];
}

interface GradeData {
  name: string;
}

interface SectionData {
  name: string;
}

interface StudentData {
  id: string;
  roll_number: string | null;
  user_id: string;
  grade_id: string;
  section_id: string;
  grades: GradeData | GradeData[];
  sections: SectionData | SectionData[];
}

interface ChatThread {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

interface AssessmentData {
  id: string;
  subject: string;
  topic: string;
  questions: any[];
  answers?: any[];
  board?: string;
  class_level: string;
  assessment_type: string;
  learning_outcomes?: string[];
  created_at: string;
  user_email: string;
}

interface StudyPlanData {
  id: string;
  subject: string;
  grade: string;
  board: string;
  learning_goal: string;
  created_at: string;
  available_days: number;
  user_email: string;
}

interface LessonContentData {
  id: string;
  user_email: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
}

interface LessonPlanData {
  id: string;
  subject: string;
  chapter_topic: string;
  grade: string;
  board: string | null;
  class_duration: number;
  number_of_days: number;
  learning_objectives: string | null;
  lesson_objectives: string | null;
  additional_instructions: string | null;
  plan_data: any;
  created_at: string;
  user_email: string;
}

interface AssignedAssessment {
  id: string;
  assessment_id: string;
  completed: boolean;
  score: number | null;
  student_answers: any[] | null;
}

export default function StudentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const resolvedParams = React.use(params);
  const [student, setStudent] = useState<StudentDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatThreadsLoading, setChatThreadsLoading] = useState(true);
  const [chatThreadsError, setChatThreadsError] = useState<string | null>(null);
  const [assessmentsLoading, setAssessmentsLoading] = useState(true);
  const [assessmentsError, setAssessmentsError] = useState<string | null>(null);
  const [studyPlansLoading, setStudyPlansLoading] = useState(true);
  const [studyPlansError, setStudyPlansError] = useState<string | null>(null);
  const [lessonContentsLoading, setLessonContentsLoading] = useState(true);
  const [lessonContentsError, setLessonContentsError] = useState<string | null>(
    null
  );
  const [lessonPlansLoading, setLessonPlansLoading] = useState(true);
  const [lessonPlansError, setLessonPlansError] = useState<string | null>(null);
  const [assignedAssessments, setAssignedAssessments] = useState<
    AssignedAssessment[]
  >([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const studentResponse = await fetch(
          `/api/students/${resolvedParams.id}`
        );
        const studentData = await studentResponse.json();

        if (!studentResponse.ok) {
          throw new Error(studentData.error);
        }

        setStudent(studentData);

        setChatThreadsLoading(true);
        try {
          const supabase = createClient();

          const { data: studentData, error: studentError } = await supabase
            .from("school_students")
            .select("user_id")
            .eq("id", resolvedParams.id)
            .single();

          if (studentError) {
            throw new Error("Student not found");
          }

          const userId = studentData.user_id;

          const { data: chatThreads, error: chatThreadsError } = await supabase
            .from("chat_threads")
            .select("id, title, created_at, updated_at")
            .eq("user_id", userId)
            .eq("archived", false)
            .order("updated_at", { ascending: false });

          if (chatThreadsError) {
            throw new Error("Failed to fetch chat history");
          }

          setStudent((prevStudent) =>
            prevStudent ? { ...prevStudent, chat_threads: chatThreads } : null
          );

          setAssessmentsLoading(true);

          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("email")
            .eq("user_id", userId)
            .single();

          if (userError) {
            throw new Error("Failed to get user email");
          }

          const { data: assessments, error: assessmentsError } = await supabase
            .from("assessments")
            .select("*")
            .eq("user_email", userData.email)
            .order("created_at", { ascending: false });

          if (assessmentsError) {
            throw new Error("Failed to fetch assessments");
          }

          const { data: assigned, error: assignedError } = await supabase
            .from("assigned_assessments")
            .select("*")
            .eq("student_id", resolvedParams.id);

          if (!assignedError && assigned) {
            setAssignedAssessments(assigned);
          }

          setStudent((prevStudent) =>
            prevStudent ? { ...prevStudent, assessments: assessments } : null
          );
          setAssessmentsLoading(false);

          setStudyPlansLoading(true);

          const { data: studyPlans, error: studyPlansError } = await supabase
            .from("study_plans")
            .select(
              "id, subject, grade, board, learning_goal, created_at, available_days, user_email"
            )
            .eq("user_email", userData.email)
            .order("created_at", { ascending: false });

          if (studyPlansError) {
            throw new Error("Failed to fetch study plans");
          }

          setStudent((prevStudent) =>
            prevStudent ? { ...prevStudent, study_plans: studyPlans } : null
          );
          setStudyPlansLoading(false);

          setLessonContentsLoading(true);

          const { data: lessonContents, error: lessonContentsError } =
            await supabase
              .from("lesson_cont_gen")
              .select("id, user_email, title, content, image_url, created_at")
              .eq("user_email", userData.email)
              .order("created_at", { ascending: false });

          if (lessonContentsError) {
            throw new Error("Failed to fetch lesson contents");
          }

          setStudent((prevStudent) =>
            prevStudent
              ? { ...prevStudent, lesson_contents: lessonContents }
              : null
          );
          setLessonContentsLoading(false);

          const { data: lessonPlans, error: lessonPlansError } = await supabase
            .from("lesson_plans")
            .select("*")
            .eq("user_email", userData.email)
            .order("created_at", { ascending: false });

          if (lessonPlansError) {
            throw new Error("Failed to fetch lesson plans");
          }

          setStudent((prevStudent) =>
            prevStudent ? { ...prevStudent, lesson_plans: lessonPlans } : null
          );
          setLessonPlansLoading(false);
        } catch (dataErr) {
          console.error("Error loading data:", dataErr);
          setChatThreadsError("Failed to load chat history");
          setAssessmentsError("Failed to load assessments");
          setStudyPlansError("Failed to load study plans");
          setLessonContentsError("Failed to load lesson contents");
          setLessonPlansError("Failed to load lesson plans");
        } finally {
          setChatThreadsLoading(false);
          setAssessmentsLoading(false);
          setStudyPlansLoading(false);
          setLessonContentsLoading(false);
          setLessonPlansLoading(false);
        }
      } catch (err) {
        console.error("Error loading student details:", err);
        setError("Could not load student details");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [resolvedParams.id]);

  const navigateToChatThread = (threadId: string) => {
    router.push(`/tools/gen-chat?thread=${threadId}`);
  };

  const viewAssessment = (assessmentId: string) => {
    const assignedAssessment = assignedAssessments.find(
      (a) => a.assessment_id === assessmentId
    );

    if (assignedAssessment) {
      router.push(
        `/assessment/${assessmentId}?assigned_id=${assignedAssessment.id}`
      );
    } else {
      alert("This assessment has not been assigned to this student.");
    }
  };

  const viewStudyPlan = (planId: string) => {
    router.push(`/tools/study-planner?plan=${planId}`);
  };

  const viewLessonContent = (lessonId: string) => {
    router.push(`/tools/lesson-content-generator?lesson=${lessonId}`);
  };

  const createLessonPlan = () => {
    if (student) {
      router.push(
        `/tools/lesson-planner/create?studentId=${student.id}&studentName=${encodeURIComponent(student.name)}&grade=${encodeURIComponent(student.grade_name)}&email=${encodeURIComponent(student.email)}`
      );
    }
  };

  const createLessonPlanFromAssessment = (
    assessmentId: string,
    subject: string,
    title: string,
    grade: string,
    board: string
  ) => {
    if (student) {
      router.push(
        `/tools/lesson-planner/create?studentId=${student.id}&studentName=${encodeURIComponent(student.name)}&assessmentId=${encodeURIComponent(assessmentId)}&grade=${encodeURIComponent(student.grade_name)}&email=${encodeURIComponent(student.email)}&subject=${encodeURIComponent(subject)}&title=${encodeURIComponent(title)}&board=${encodeURIComponent(board || "CBSE")}`
      );
    }
  };

  const viewLessonPlan = (planId: string) => {
    const route = `/tools/lesson-planner/output?id=${planId}`;
    router.push(route);
  };

  if (loading) {
    return (
      <DashboardLayout title="Student Details">
        <div className="animate-pulse text-center py-8">
          Loading student details...
        </div>
      </DashboardLayout>
    );
  }

  if (error || !student) {
    return (
      <DashboardLayout title="Student Details">
        <div className="text-red-500 text-center py-8">
          {error || "Student not found"}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title={`Student Details - ${student.name}`}>
      <div className="mb-4">
        <Button
          onClick={() => router.push("/dashboard")}
          className="px-4 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 flex items-center gap-2"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </Button>
      </div>
      <div className="space-y-6">
        <DashboardCard title="Student Information">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Name</label>
              <p className="text-base text-gray-900">{student.name}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Email</label>
              <p className="text-base text-gray-900">{student.email}</p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">
                Roll Number
              </label>
              <p className="text-base text-gray-900">
                {student.roll_number || "N/A"}
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium text-gray-500">Class</label>
              <p className="text-base text-gray-900">
                {student.grade_name} - {student.section_name}
              </p>
            </div>
          </div>
        </DashboardCard>

        <DashboardCard title="Buddy Interactions">
          <div className="p-6">
            {chatThreadsLoading ? (
              <div className="animate-pulse text-center py-4">
                Loading buddy interactions...
              </div>
            ) : chatThreadsError ? (
              <div className="text-red-500 text-center py-4">
                {chatThreadsError}
              </div>
            ) : student.chat_threads && student.chat_threads.length > 0 ? (
              <ChatThreadsTable
                chatThreads={student.chat_threads}
                navigateToChatThread={navigateToChatThread}
              />
            ) : (
              <p className="text-center text-gray-500">
                No buddy interactions available
              </p>
            )}
          </div>
        </DashboardCard>

        <AssessmentHistory
          assessments={student.assessments}
          loading={assessmentsLoading}
          error={assessmentsError}
          assignedAssessments={assignedAssessments}
          viewAssessment={viewAssessment}
          studentEmail={student.email}
          createLessonPlanFromAssessment={createLessonPlanFromAssessment}
        />

        <DashboardCard title="Study Plan History">
          <div className="p-6">
            {studyPlansLoading ? (
              <div className="animate-pulse text-center py-4">
                Loading study plan history...
              </div>
            ) : studyPlansError ? (
              <div className="text-red-500 text-center py-4">
                {studyPlansError}
              </div>
            ) : student.study_plans && student.study_plans.length > 0 ? (
              <div className="relative w-full overflow-auto max-h-[400px] scrollbar-thin">
                <style>{`
                .scrollbar-thin::-webkit-scrollbar {
                  width: 6px;
                  height: 6px;
                }
                .scrollbar-thin::-webkit-scrollbar-track {
                  background: transparent;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb {
                  background-color: rgba(0, 0, 0, 0.1);
                  border-radius: 3px;
                }
                .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                  background-color: rgba(0, 0, 0, 0.2);
                }
                .dark .scrollbar-thin::-webkit-scrollbar-thumb {
                  background-color: rgba(255, 255, 255, 0.1);
                }
                .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
                  background-color: rgba(255, 255, 255, 0.2);
                }
                `}</style>
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Board
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Subject
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Grade
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Goal
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Duration
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.study_plans.map((plan) => (
                      <tr
                        key={plan.id}
                        className="border-b transition-colors hover:bg-gray-100"
                      >
                        <td className="p-4 align-middle">
                          {plan.board || "N/A"}
                        </td>
                        <td className="p-4 align-middle">{plan.subject}</td>
                        <td className="p-4 align-middle">{plan.grade}</td>
                        <td className="p-4 align-middle truncate max-w-[200px]">
                          {plan.learning_goal}
                        </td>
                        <td className="p-4 align-middle">
                          {plan.available_days} days
                        </td>
                        <td className="p-4 align-middle">
                          {new Date(plan.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500">
                No study plan history available
              </p>
            )}
          </div>
        </DashboardCard>

        <DashboardCard title="Lesson Content History">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Past Lessons</h3>
              <Button
                onClick={createLessonPlan}
                className="bg-rose-600 hover:bg-rose-700 text-white"
              >
                Create Lesson Plan
              </Button>
            </div>
            {lessonContentsLoading ? (
              <div className="animate-pulse text-center py-4">
                Loading lesson content history...
              </div>
            ) : lessonContentsError ? (
              <div className="text-red-500 text-center py-4">
                {lessonContentsError}
              </div>
            ) : student.lesson_contents &&
              student.lesson_contents.length > 0 ? (
              <div className="relative w-full overflow-auto max-h-[400px] scrollbar-thin">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Title
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Content Preview
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Has Image
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.lesson_contents.map((lesson) => (
                      <tr
                        key={lesson.id}
                        className="border-b transition-colors hover:bg-gray-100"
                      >
                        <td className="p-4 align-middle truncate max-w-[200px]">
                          {lesson.title}
                        </td>
                        <td className="p-4 align-middle truncate max-w-[300px]">
                          {lesson.content.substring(0, 100)}...
                        </td>
                        <td className="p-4 align-middle">
                          {lesson.image_url ? "Yes" : "No"}
                        </td>
                        <td className="p-4 align-middle">
                          {new Date(lesson.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500">
                No lesson content history available
              </p>
            )}
          </div>
        </DashboardCard>

        <DashboardCard title="Lesson Plans">
          <div className="p-6">
            {lessonPlansLoading ? (
              <div className="animate-pulse text-center py-4">
                Loading lesson plans...
              </div>
            ) : lessonPlansError ? (
              <div className="text-red-500 text-center py-4">
                {lessonPlansError}
              </div>
            ) : student.lesson_plans && student.lesson_plans.length > 0 ? (
              <div className="relative w-full overflow-auto max-h-[400px] scrollbar-thin">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Subject
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Topic
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Duration
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Days
                      </th>
                      <th className="h-12 px-4 text-left align-middle font-medium text-gray-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {student.lesson_plans.map((plan) => (
                      <tr
                        key={plan.id}
                        className="border-b transition-colors hover:bg-gray-100 cursor-pointer"
                        onClick={() => viewLessonPlan(plan.id)}
                      >
                        <td className="p-4 align-middle">{plan.subject}</td>
                        <td className="p-4 align-middle truncate max-w-[300px]">
                          {plan.chapter_topic}
                        </td>
                        <td className="p-4 align-middle">
                          {plan.class_duration} mins
                        </td>
                        <td className="p-4 align-middle">
                          {plan.number_of_days}
                        </td>
                        <td className="p-4 align-middle">
                          {new Date(plan.created_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            }
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-500">
                No lesson plans available
              </p>
            )}
          </div>
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
