export function NairaText({ value }: { value: string }) {
  return (
    <>
      {value.split(/(₦)/g).map((segment, index) =>
        segment === "₦" ? (
          <span className="naira-symbol" key={`naira-${index}`}>
            {segment}
          </span>
        ) : (
          segment
        )
      )}
    </>
  );
}
