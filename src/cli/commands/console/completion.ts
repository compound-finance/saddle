
function matchesLine(completion, line) {
  if (completion.initial && line.startsWith(completion.initial)) {
    return true;
  }

  return false;
}

function targetMatches(completion, line) {
  let words = line.split(/\s+/);
  let position = words.length - 1; // e.g. "deploy" = 0 "deploy " = 1 "deploy abc" = 1
  let lastWord = words.length === 0 ? "" : words[words.length - 1];
  let targets = completion.targets.filter(({pos}) => pos === position);

  let matching = targets.reduce((acc, {choices}) => {
    return [
      ...acc,
      ...choices.filter((choice) => choice.startsWith(lastWord))
    ];
  }, []);

  if (lastWord.length > 0) {
    return [matching, lastWord];
  } else {
    return [matching, line];
  }
}

function getCompleter(defaultCompleter, completions) {
  return function(line, callback) {
    const lineMatches = completions.filter((completion) => matchesLine(completion, line));
    let [choices, text] = lineMatches.reduce(([accMatch, accText], completion) => {
      let [matches, text] = targetMatches(completion, line);

      if (matches && text.length < accText.length) {
        return [matches, text];
      } else if (matches && text.length === accText.length) {
        return [ [ ...accMatch, ...matches ], accText];
      } else {
        return [accMatch, accText];
      }
    }, [[], line]);

    if (choices.length > 0) {
      callback(null, [choices, text]);
    } else {
      defaultCompleter(line, callback);
    }
  }
}

export function getCompletions(defaultCompleter, contracts) {
  let contractNames = Object.keys(contracts)
  let contractAddresses = Object.values(contracts).filter((x) => !!x);

  const completions = [
    {
      initial: '.deploy',
      targets: [
        {
          pos: 1,
          choices: contractNames
        }
      ]
    },
    {
      initial: '.match',
      targets: [
        {
          pos: 1,
          choices: contractAddresses
        },
        {
          pos: 2,
          choices: contractNames
        }
      ]
    }
  ];

  return getCompleter(defaultCompleter, completions);
}
