import QuestionnaireForm from "@/components/QuestionnaireForm";
import { QUESTIONS } from "@/lib/questionnaire";

export default function HomePage() {
  return <QuestionnaireForm questions={QUESTIONS} />;
}