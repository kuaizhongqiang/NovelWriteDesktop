
public class AllData
{
    public Novel[] novels;
    public WritingStyle[] writingStyles;
}

public class Novel
{
    public string id;
    public string title;
    public NovelBaseData novelBaseData;
    public RoleList roleList;
    public Outline outline;
    public ChapterList chapterList;
    public WritingStyle writingStyle;
    public DateTime created;
    public DateTime updated;
    public bool isOpen;
}

public class NovelBaseData
{
    public string description;
    public string oneWord;
    public string genre;
    public string[] tags;
}

public class RoleList
{
    public RoleData mainRole;
    public RoleData[] femaleRoles;
    public RoleData[] supportingRoles;
}

public class RoleData
{
    public string roleName;
    public string roleDescription;
    public string relationshipToMainRole;

}

public class Outline
{
    public string mainRoleSuperpower;
    public string worldView;
    public string writingKeyPoints;
    public OutlinePhase[] outlinePhases;
}

public class OutlinePhase
{
    public string id;
    public int sort;
    public string title;
    public string description;
    public ChapterOutline[] chapterOutlines;
}

public class ChapterOutline
{
    public string id;
    public int sort;
    public string chapterTitle;
    public string chapterDescription;
    public string hook;
}

public class ChapterList
{
    public Chapter[] chapters;
}

public class Chapter
{
    public string id;
    public int sort;
    public string content;
}

public class WritingStyle
{
    public string id;
    public Range charPerChapter;
    public int fullStoryLength;
    public string baseTone;
}