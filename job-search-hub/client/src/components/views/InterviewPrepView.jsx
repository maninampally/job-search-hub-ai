import { INTERVIEW_QUESTIONS } from "../../pages/dashboard/interviewData";

export default function InterviewPrepView({
  filteredQuestions,
  questionFilter,
  interviewAnswers,
  onQuestionFilterChange,
  onAnswerChange,
}) {
  return (
    <section className="module-panel">
      <header className="module-header">
        <div>
          <h1>Interview Prep</h1>
          <p>Save STAR answers and preparation notes per question.</p>
        </div>
      </header>

      <div className="filters-row">
        <select value={questionFilter} onChange={(event) => onQuestionFilterChange(event.target.value)}>
          <option value="All">All Categories</option>
          <option value="Technical">Technical</option>
          <option value="System Design">System Design</option>
          <option value="Behavioral">Behavioral</option>
        </select>
      </div>

      <div className="question-list">
        {filteredQuestions.map((question) => (
          <article key={question.id} className="question-card">
            <header>
              <h4>{question.text}</h4>
              <span className="chip">
                {question.category} · {question.difficulty}
              </span>
            </header>
            <textarea
              value={interviewAnswers[question.id] || ""}
              onChange={(event) => onAnswerChange(question.id, event.target.value)}
              placeholder="Write your answer here..."
            />
          </article>
        ))}
      </div>
    </section>
  );
}
