import MCQQuestion from "./MCQQuestion"
import TrueFalseQuestion from "./TrueFalseQuestion"
import FillInTheBlankQuestion from "./FillInTheBlankQuestion"
import ShortQuestion from "./ShortQuestion"

interface MixedAssessmentQuestionProps {
  question: any;
  index: number;
  userAnswer: any;
  onChange: (answer: any) => void;
  showResults: boolean;
}

export default function MixedAssessmentQuestion({
  question,
  index,
  userAnswer,
  onChange,
  showResults,
}: MixedAssessmentQuestionProps) {
  // Normalize questionType for comparison
  const rawType = question.questionType || "";
  const questionType = rawType.toLowerCase();

  if (questionType === "mcq") {
    // Transform options if they're coming as an object instead of an array
    let optionsArray: string[] = [];
    if (Array.isArray(question.options)) {
      optionsArray = question.options;
    } else if (question.options && typeof question.options === "object") {
      // If keys are letters, sort them so A, B, C... become the array order
      optionsArray = Object.keys(question.options)
        .sort()
        .map((key) => question.options[key]);
    }
    // Convert correctAnswer from letter to index if needed.
    let correctAnswerIndex: number = 0;
    if (typeof question.correctAnswer === "string") {
      // Assuming "A" corresponds to index 0, "B" to 1, etc.
      correctAnswerIndex =
        question.correctAnswer.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
    } else {
      correctAnswerIndex = question.correctAnswer;
    }
    const mcqQuestion = {
      ...question,
      options: optionsArray,
      correctAnswer: correctAnswerIndex,
    };

    return (
      <MCQQuestion
        question={mcqQuestion}
        index={index}
        userAnswer={userAnswer}
        onChange={onChange}
        showResults={showResults}
      />
    );
  } else if (questionType === "true/false" || questionType === "truefalse") {
    // Ensure correctAnswer is boolean
    const trueFalseQuestion = {
      ...question,
      correctAnswer:
        typeof question.correctAnswer === "string"
          ? question.correctAnswer.toLowerCase() === "true"
          : question.correctAnswer,
    };
    return (
      <TrueFalseQuestion
        question={trueFalseQuestion}
        index={index}
        userAnswer={userAnswer}
        onChange={onChange}
        showResults={showResults}
      />
    );
  } else if (questionType === "fill in the blanks" || questionType === "fillintheblanks") {
    // For fill-in-the-blanks, ensure there is an options array.
    let optionsArray: string[] = [];
    if (question.options && Array.isArray(question.options)) {
      optionsArray = question.options;
    } else if (question.distractors && Array.isArray(question.distractors)) {
      // Combine correctAnswer and distractors.
      optionsArray = [question.correctAnswer, ...question.distractors];
    }
    const fillInQuestion = {
      ...question,
      options: optionsArray,
    };
    return (
      <FillInTheBlankQuestion
        question={fillInQuestion}
        index={index}
        userAnswer={userAnswer}
        onChange={onChange}
        showResults={showResults}
      />
    );
  } else if (questionType === "short answer" || questionType === "shortanswer") {
    return (
      <ShortQuestion
        question={question}
        index={index}
        userAnswer={userAnswer}
        onChange={onChange}
        showResults={showResults}
        evaluatedScore={undefined} // Adjust if you have evaluation logic
      />
    );
  } else {
    // Fallback rendering if type is unrecognized.
    return (
      <div className="p-4 border rounded mb-4">
        <p>{question.question}</p>
      </div>
    );
  }
}
